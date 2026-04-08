import os
import re
import pandas as pd

def parse_observable_file(filepath):
    """
    Parses a raw observable text log applying Regex to securely extract
    temporal overlap metrics and structured behavior breakdowns.
    """
    events = {'logon': 0, 'device': 0, 'http': 0, 'email': 0, 'file': 0}
    dates = set()

    if not os.path.exists(filepath):
        return None
    
    try:
        # Better regex for standard CERT formats (MM/DD/YYYY or YYYY-MM-DD)
        date_pattern = re.compile(r'\b(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})\b')
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line_lower = line.lower()
                
                # Check for behavior signatures
                if 'logon' in line_lower or 'log off' in line_lower or 'after hours' in line_lower: events['logon'] += 1
                if 'usb' in line_lower or 'drive' in line_lower or 'device' in line_lower: events['device'] += 1
                if 'http' in line_lower or 'website' in line_lower or 'url' in line_lower: events['http'] += 1
                if 'email' in line_lower or 'attachment' in line_lower: events['email'] += 1
                if 'file' in line_lower or '.exe' in line_lower or '.zip' in line_lower: events['file'] += 1
                        
                # Extract dates
                matches = date_pattern.findall(line)
                for match in matches:
                    dates.add(match)
        
        # Flawless chronological sorting (No string sorting bugs)
        datetime_objects = pd.to_datetime(list(dates), errors='coerce').dropna()
        if not datetime_objects.empty:
            datetime_objects = datetime_objects.sort_values()
            return {
                'events': events,
                'start_date': datetime_objects.iloc[0].strftime('%Y-%m-%d'),
                'end_date': datetime_objects.iloc[-1].strftime('%Y-%m-%d'),
                'all_dates': [d.strftime('%Y-%m-%d') for d in datetime_objects]
            }
        else:
            return {
                'events': events,
                'start_date': None,
                'end_date': None,
                'all_dates': []
            }
            
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
        return None
