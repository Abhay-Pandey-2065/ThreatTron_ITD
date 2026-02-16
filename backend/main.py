from fastapi import FastAPI
from database import engine
from models import Base

from routes import files, processes, system, emails, usb

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(files.router, prefix="/events/files")
app.include_router(processes.router, prefix="/events/processes")
app.include_router(system.router, prefix="/events/system")
app.include_router(emails.router, prefix="/events/emails")
app.include_router(usb.router, prefix="/events/usb")

@app.get("/")
def root():
    return {"message": "ThreatTron Modular Backend Running"}
