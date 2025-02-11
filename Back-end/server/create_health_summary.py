import pandas as pd
import json
from data_manager import DataManager


class CreateHealthSummary(DataManager):
    """
    Health summary manager
    """
    def __init__(self,userId):
        self.connect_to_db()
        self.healthData = self.load_patient_summary(userId)
        

    def get_health_summary_as_strings(self) -> list[str]: 
        return self.healthData.to_string()

    def load_patient_summary(self,userId) -> pd.DataFrame:
        """
        Based off userId pulls user health information from database
        """
        query = (''' 
        SELECT 
            u.name, 
            u.age, 
            u.gender, 
            d.diet_type AS diet_type,
            p.activity_level AS physical_activity_level,
            a.consumption_level AS alcohol_consumption_level,
            u.blood_pressure,
            u.weight_kg,
            u.height_cm,
            u.bmi
        FROM 
            UserPersonalData u
        JOIN 
            DietType d ON u.diet_type_id = d.diet_type_id
        JOIN 
            PhysicalActivityLevel p ON u.physical_activity_level_id = p.pal_id
        JOIN 
            AlcoholConsumption a ON u.alcohol_consumption_id = a.alcohol_consumption_id
        WHERE u.patient_id = ?;
   
        ''')
        return (pd.read_sql_query(query, self.conn, params = (userId,)))
        
