import psutil
import sqlite3
import hashlib
import time
import os

CONSENT_GRANTED = True 

DB_PATH = "simple_agent_data.db"
RETENTION_HOURS = 24  
SALT = "my_secure_salt_string" 

def setup_database():
    """Creates a simple SQLite database to store our connections if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS network_connections (
            timestamp REAL,
            local_ip_hash TEXT,
            local_port INTEGER,
            remote_ip_hash TEXT,
            remote_port INTEGER,
            status TEXT
        )
    ''')
    conn.commit()
    conn.close()

def hash_ip(ip_address):
    """
    ETHICAL GUARDRAIL 3: IP HASHING
    Converts a real IP (like '192.168.1.5') into a scrambled string to protect privacy.
    """
    if not ip_address:
        return None
    h = hashlib.sha256()
    h.update(SALT.encode('utf-8'))
    h.update(str(ip_address).encode('utf-8'))
    return h.hexdigest()

def collect_and_store_data():
    """
    ETHICAL GUARDRAIL 2: NO PAYLOADS
    We ONLY collect active connections (ports and hashed IPs). We do NOT look at the file contents / payloads being sent.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 'psutil' gets all active internet connections (similar to the 'netstat' command in Windows)
    connections = psutil.net_connections(kind='inet')
    current_time = time.time()
    
    connections_logged = 0
    for c in connections:
        if c.laddr and c.raddr: # Only track connections with both local and remote ends
            
            # Scramble the IPs immediately. Never save the raw IP.
            local_hash = hash_ip(c.laddr.ip)
            remote_hash = hash_ip(c.raddr.ip)
            
            cursor.execute('''
                INSERT INTO network_connections 
                (timestamp, local_ip_hash, local_port, remote_ip_hash, remote_port, status)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (current_time, local_hash, c.laddr.port, remote_hash, c.raddr.port, c.status))
            
            connections_logged += 1
            
    conn.commit()
    conn.close()
    
    print(f"[{time.ctime()}] Logged {connections_logged} active connections securely.")

def purge_old_data():
    """
    ETHICAL GUARDRAIL 4: DATA AUTO-PURGE
    Deletes any database records older than our RETENTION_HOURS.
    """
    cutoff_time = time.time() - (RETENTION_HOURS * 3600)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Delete where the timestamp is older than the cutoff time
    cursor.execute("DELETE FROM network_connections WHERE timestamp < ?", (cutoff_time,))
    deleted_count = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    if deleted_count > 0:
        print(f"[{time.ctime()}] PURGED {deleted_count} old records to protect privacy.")

def main():
    # 1. Check for explicit consent
    if not CONSENT_GRANTED:
        print("ERROR: Consent not granted. Please change CONSENT_GRANTED to True in the script.")
        return
        
    print("Starting Simplified Ethical Network Agent...")
    setup_database()
    
    loops_run = 0
    
    try:
        # 2. Start the infinite collection loop
        while True:
            collect_and_store_data()
            
            # Every 10 loops (approx 1 minute), check if we need to auto-purge old data
            loops_run += 1
            if loops_run >= 10:
                purge_old_data()
                loops_run = 0
                
            # Wait 5 seconds before checking the network again
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nAgent stopped by user. Goodbye!")

if __name__ == "__main__":
    main()
