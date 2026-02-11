from utils.config import base_event
import random

def collect_file_activity():
    sample_files = [

    ]
    event = base_event("file_activity")
    event["metadata"] = {
        "file_path": random.choice(sample_files),
        "action": random.choice(["read", "write", "delete"])
    }
    return [event]