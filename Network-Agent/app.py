import streamlit as st
import sqlite3
import pandas as pd
import time
import os

# --- Page Config ---
st.set_page_config(page_title="Ethical Agent Live Monitor", layout="wide", page_icon="🛡️")

DB_PATH = "simple_agent_data.db"

def load_data():
    """Connects to SQLite and retrieves the logged data securely."""
    if not os.path.exists(DB_PATH):
        return pd.DataFrame()
        
    try:
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query("SELECT * FROM network_connections ORDER BY timestamp DESC LIMIT 500", conn)
        conn.close()
        
        # Format the Unix Timestamps to human-readable strings
        if not df.empty:
            df['Time Logged'] = pd.to_datetime(df['timestamp'], unit='s').dt.strftime('%H:%M:%S')
            df.drop('timestamp', axis=1, inplace=True)
            
            # Rearrange columns so Time is first
            cols = ['Time Logged'] + [c for c in df.columns if c != 'Time Logged']
            df = df[cols]
            
        return df
    except Exception as e:
        return pd.DataFrame()

# --- Main App ---
st.title("🛡️ Ethical Network Data Monitor")
st.markdown("This Streamlit app provides a real-time showcase of the agent pulling active connection metadata. All privacy guardrails remain strictly enforced.")

# We create a placeholder section in Streamlit that we can inject refreshed data into 
placeholder = st.empty()

# Create an infinite loop to refresh the page automatically every 3 seconds
while True:
    df = load_data()
    
    with placeholder.container():
        if df.empty:
            st.warning("⚠️ No data found in the database. Ensure you are running `python simple_agent.py` in the background!")
        else:
            
            # --- Row 1: Key Metrics ---
            total_logged = len(df)
            unique_targets = df['remote_ip_hash'].nunique()
            established = len(df[df['status'] == 'ESTABLISHED'])
            
            col1, col2, col3 = st.columns(3)
            col1.metric("Recent Entries Sniffed", total_logged)
            col2.metric("Unique Remote Endpoints", unique_targets)
            col3.metric("Live Connections", established)
            
            st.divider()

            # --- Row 2: Live Scrolling Log ---
            st.subheader("📡 Live Metadata Feed (Hashes Only)")
            
            # Visual formatting so hashes don't take up the entire screen width
            display_df = df.copy()
            if 'local_ip_hash' in display_df.columns:
                display_df['local_ip_hash'] = display_df['local_ip_hash'].apply(lambda x: str(x)[:12] + "...")
                display_df['remote_ip_hash'] = display_df['remote_ip_hash'].apply(lambda x: str(x)[:12] + "...")
            
            # Render the interactive dataframe table
            st.dataframe(display_df, width='stretch', hide_index=True)
            
            st.divider()

            # --- Row 3: Live Academic Defense Explanations ---
            with st.expander("🎓 View Academic & Ethical Design Breakdown"):
                st.markdown("""
                ##### Defensible Guardrails:
                1. **Explicit Consent**: The python agent strictly refuses to spin up memory loops unless `CONSENT_GRANTED = True` inside the core file.
                2. **No Payload Capture**: Traditional agents use `scapy` or Wireshark to grab whole packets. This agent utilizes standard `psutil` calls, making it physically impossible for file downloads or website payload HTML to touch your disk.
                3. **IP Hashing**: Look at the table above! We run endpoints through a `SHA-256` hashing protocol on the fly. We still know if anomalous traffic is routing to the *same* remote hash (critical for training an Intrusion Detection Model), but we don't violate privacy by recording WHO it actually is.
                4. **Database Auto-Purge**: The backend script automatically purges stale `.db` data after 24 hours.
                """)

    # Give Streamlit 3 seconds of rest before reading the DB again
    time.sleep(3)
