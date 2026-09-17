SEVERITY_MAP = {
    "longitudinal crack": "Low",
    "longitudinal crack wide": "Medium",
    "transverse crack": "Low",
    "transverse crack wide": "Medium",
    "alligator crack": "Medium",
    "alligator crack sunken": "High",
    "pothole": "Medium",
    "pothole deep": "High",
}


def get_severity(class_name: str) -> str:
    return SEVERITY_MAP.get(class_name, "Unknown")