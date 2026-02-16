import subprocess

backend = subprocess.Popen(
    ["uvicorn", "backend.main:app", "--reload"],
    shell=True
)

agent = subprocess.Popen(
    ["python", "agent/src/main.py"],
    shell=True
)

backend.wait()
agent.wait()