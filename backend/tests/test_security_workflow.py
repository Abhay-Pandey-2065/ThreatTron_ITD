import unittest
import bcrypt
from datetime import datetime
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    AgentSession,
    Alert,
    AuditEvent,
    InvestigationNote,
    Investigation,
    RiskAssessment,
    SandboxAlert,
    SandboxAuditEvent,
    SandboxInvestigation,
    SandboxInvestigationNote,
    SandboxRiskCase,
    User,
)
from routes import security


class SecurityWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.session_factory = sessionmaker(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.session_factory()
        self.db.add(User(
            email="analyst@example.test",
            hashed_password=bcrypt.hashpw(b"test-password", bcrypt.gensalt()).decode("utf-8"),
            role="admin",
        ))
        self.db.add(AgentSession(
            session_id="session-1",
            agent_id="agent-1",
            started_at=datetime(2026, 1, 1),
        ))
        self.db.commit()

        self.app = FastAPI()
        self.app.include_router(security.router, prefix="/api/security")

        def override_db():
            db = self.session_factory()
            try:
                yield db
            finally:
                db.close()

        self.app.dependency_overrides[security.get_db] = override_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()

    def test_risk_persists_and_deduplicates_alert_with_telemetry_references(self):
        result = {
            "risk_score": 0.86,
            "is_threat": True,
            "ml_score": 0.82,
            "rule_score": 0.9,
            "rules_triggered": ["suspicious_process"],
        }
        refs = [{"type": "process", "id": 31, "raw_event": "must not be stored"}]
        assessment, alert = security.record_risk_assessment(self.db, "agent-1", result, refs)
        _, repeated_alert = security.record_risk_assessment(self.db, "agent-1", result, refs)

        self.assertIsNotNone(alert)
        self.assertEqual(alert.id, repeated_alert.id)
        self.assertEqual(self.db.query(Alert).count(), 1)
        self.assertEqual(self.db.query(RiskAssessment).count(), 2)
        self.assertEqual(assessment.evidence_refs, [{"type": "process", "id": 31}])

        response = self.client.get("/api/security/alerts")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["alerts"][0]["evidence_refs"], [{"type": "process", "id": 31}])

        investigation_response = self.client.post(
            "/api/security/investigations",
            json={"alert_id": alert.id, "title": "Review suspicious process"},
        )
        self.assertEqual(investigation_response.status_code, 201)
        investigation_id = investigation_response.json()["id"]

        note_response = self.client.post(
            f"/api/security/investigations/{investigation_id}/notes",
            json={"body": "Validated process against endpoint telemetry."},
        )
        self.assertEqual(note_response.status_code, 201)
        self.assertEqual(note_response.json()["body"], "Validated process against endpoint telemetry.")

        feedback_response = self.client.post(
            f"/api/security/alerts/{alert.id}/feedback",
            json={"verdict": "false_positive", "note": "Approved admin tool."},
        )
        self.assertEqual(feedback_response.status_code, 200)
        self.assertTrue(feedback_response.json()["false_positive"])
        self.assertEqual(feedback_response.json()["status"], "false_positive")

        self.db.expire_all()
        _, suppressed_alert = security.record_risk_assessment(self.db, "agent-1", result, refs)
        self.assertIsNone(suppressed_alert)
        _, new_evidence_alert = security.record_risk_assessment(
            self.db,
            "agent-1",
            result,
            [{"type": "process", "id": 32}],
        )
        self.assertIsNotNone(new_evidence_alert)
        self.assertEqual(self.db.query(Alert).count(), 2)

        audit_response = self.client.get(f"/api/security/audit?entity_type=investigation&entity_id={investigation_id}")
        self.assertEqual(audit_response.status_code, 200)
        actions = [event["action"] for event in audit_response.json()["events"]]
        self.assertIn("created", actions)
        self.assertIn("note_added", actions)
        self.assertTrue(all(event["actor_user_id"] is None for event in audit_response.json()["events"]))

    def test_alert_threshold_uses_medium_risk_score_cutoff(self):
        with patch.dict("os.environ", {}, clear=True):
            _, below_threshold = security.record_risk_assessment(
                self.db,
                "agent-below",
                {"risk_score": 0.39, "is_threat": False, "rules_triggered": []},
            )
            _, at_threshold = security.record_risk_assessment(
                self.db,
                "agent-at",
                {"risk_score": 0.4, "is_threat": False, "rules_triggered": []},
            )

        self.assertIsNone(below_threshold)
        self.assertIsNotNone(at_threshold)
        self.assertEqual(at_threshold.severity, "medium")
        self.assertEqual(at_threshold.risk_score, 0.4)
        self.assertEqual(security.normalize_risk_score(1.2), 1.0)
        self.assertEqual(security.normalize_risk_score(-0.2), 0.0)

    def test_startup_schema_creation_recreates_missing_tables_without_losing_legacy_data(self):
        security.record_risk_assessment(
            self.db,
            "agent-1",
            {"risk_score": 0.1, "is_threat": False, "rules_triggered": []},
        )
        self.db.execute(text("DROP TABLE investigation_notes"))
        self.db.execute(text("DROP TABLE investigations"))
        self.db.execute(text("DROP TABLE audit_events"))
        self.db.execute(text("DROP TABLE alerts"))
        self.db.execute(text("DROP TABLE risk_assessments"))
        self.db.commit()

        Base.metadata.create_all(bind=self.engine)

        self.assertEqual(self.db.query(User).count(), 1)
        self.assertEqual(self.db.query(AgentSession).count(), 1)
        self.assertEqual(self.db.query(RiskAssessment).count(), 0)
        self.db.add(RiskAssessment(agent_id="agent-1", risk_score=0.3, result={}))
        self.db.commit()
        self.assertEqual(self.db.query(RiskAssessment).count(), 1)

    def test_sandbox_workflow_is_labeled_and_isolated_from_production(self):
        response = self.client.post(
            "/api/security/sandbox/cases",
            json={"scenario": "critical"},
        )
        self.assertEqual(response.status_code, 201)
        case = response.json()
        self.assertTrue(case["is_simulation"])
        self.assertTrue(case["alert"]["is_simulation"])
        alert_id = case["alert"]["id"]

        status_response = self.client.patch(
            f"/api/security/sandbox/alerts/{alert_id}",
            json={"status": "acknowledged", "note": "Sandbox acknowledgment"},
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.json()["is_simulation"])

        feedback_response = self.client.post(
            f"/api/security/sandbox/alerts/{alert_id}/feedback",
            json={"verdict": "false_positive", "note": "Test false-positive handling"},
        )
        self.assertEqual(feedback_response.status_code, 200)
        self.assertTrue(feedback_response.json()["false_positive"])
        self.assertTrue(feedback_response.json()["is_simulation"])

        investigation_response = self.client.post(
            "/api/security/sandbox/investigations",
            json={"alert_id": alert_id, "title": "Simulated investigation"},
        )
        self.assertEqual(investigation_response.status_code, 201)
        investigation = investigation_response.json()
        investigation_id = investigation["id"]
        self.assertTrue(investigation["is_simulation"])

        note_response = self.client.post(
            f"/api/security/sandbox/investigations/{investigation_id}/notes",
            json={"body": "Simulated evidence review."},
        )
        self.assertEqual(note_response.status_code, 201)
        self.assertTrue(note_response.json()["is_simulation"])

        status_note_response = self.client.patch(
            f"/api/security/sandbox/investigations/{investigation_id}",
            json={"status": "in_progress", "analyst_note": "Sandbox status updated."},
        )
        self.assertEqual(status_note_response.status_code, 200)
        self.assertEqual(status_note_response.json()["analyst_notes"][-1]["body"], "Sandbox status updated.")
        self.assertTrue(status_note_response.json()["timeline"])
        self.assertEqual(status_note_response.json()["evidence_refs"], [])

        detail_response = self.client.get(
            f"/api/security/sandbox/investigations/{investigation_id}"
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertTrue(detail_response.json()["is_simulation"])

        overview_response = self.client.get("/api/security/sandbox/overview")
        self.assertEqual(overview_response.status_code, 200)
        self.assertTrue(overview_response.json()["is_simulation"])
        self.assertEqual(overview_response.json()["risk_cases"], 1)
        self.assertEqual(overview_response.json()["alerts"], 1)

        audit_response = self.client.get("/api/security/sandbox/audit")
        self.assertEqual(audit_response.status_code, 200)
        self.assertTrue(audit_response.json()["is_simulation"])
        self.assertTrue(all(event["is_simulation"] for event in audit_response.json()["events"]))

        self.assertEqual(self.db.query(SandboxRiskCase).count(), 1)
        self.assertEqual(self.db.query(SandboxAlert).count(), 1)
        self.assertEqual(self.db.query(SandboxInvestigation).count(), 1)
        self.assertEqual(self.db.query(SandboxInvestigationNote).count(), 2)
        self.assertGreater(self.db.query(SandboxAuditEvent).count(), 0)
        self.assertEqual(self.db.query(RiskAssessment).count(), 0)
        self.assertEqual(self.db.query(Alert).count(), 0)
        self.assertEqual(self.db.query(Investigation).count(), 0)
        self.assertEqual(self.db.query(AuditEvent).count(), 0)

    def test_verified_basic_actor_is_written_to_audit_and_investigation_detail(self):
        _, alert = security.record_risk_assessment(
            self.db,
            "actor-agent",
            {"risk_score": 0.9, "is_threat": True, "rules_triggered": ["test_rule"]},
            [{"type": "process", "id": 81}],
        )
        create_response = self.client.post(
            "/api/security/investigations",
            json={"alert_id": alert.id},
            auth=("analyst@example.test", "test-password"),
        )
        self.assertEqual(create_response.status_code, 201)
        investigation_id = create_response.json()["id"]

        update_response = self.client.patch(
            f"/api/security/investigations/{investigation_id}",
            json={"analyst_note": "Verified actor note."},
            auth=("analyst@example.test", "test-password"),
        )
        self.assertEqual(update_response.status_code, 200)
        details = update_response.json()
        self.assertEqual(details["analyst_notes"][0]["body"], "Verified actor note.")
        self.assertEqual(details["evidence_refs"], [{"type": "process", "id": 81}])
        self.assertTrue(details["timeline"])
        self.assertEqual(details["timeline"][-1]["actor_email"], "analyst@example.test")

        timeline_response = self.client.get(
            f"/api/security/investigations/{investigation_id}/timeline"
        )
        self.assertEqual(timeline_response.status_code, 200)
        self.assertEqual(timeline_response.json()["evidence_refs"], [{"type": "process", "id": 81}])

        unauthenticated = self.client.patch(
            f"/api/security/alerts/{alert.id}",
            json={"status": "acknowledged"},
            headers={"X-User": "forged@example.test"},
        )
        self.assertEqual(unauthenticated.status_code, 200)
        self.db.expire_all()
        audit = self.db.query(AuditEvent).filter(
            AuditEvent.entity_type == "alert",
            AuditEvent.entity_id == alert.id,
            AuditEvent.action == "status_changed",
        ).order_by(AuditEvent.id.desc()).first()
        self.assertIsNone(audit.actor_email)

        invalid_credentials = self.client.patch(
            f"/api/security/alerts/{alert.id}",
            json={"status": "resolved"},
            auth=("analyst@example.test", "wrong-password"),
        )
        self.assertEqual(invalid_credentials.status_code, 401)


if __name__ == "__main__":
    unittest.main()
