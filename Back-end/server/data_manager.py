import os
import glob
import json
import pandas as pd
import sqlite3
from datetime import datetime

__db_file__ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db_api_backend", "bin", "database", "deviceDatadb.sqlite"))

class DataManager():
    """
    Data Manager Parent Class. Responsible for connecting and inserting information to the database"""
    def __init__(self):
        self.connect_to_db()

    def connect_to_db(self):
        self.conn = sqlite3.connect(__db_file__)
        self.cursor = self.conn.cursor()
    
    def insert_deivce_data(self ,dataName: str, dataValue: float, date: str, timestamp: str, userID):
        """
        Insert Device Data into database
        """
        
        self.cursor.execute('''
        INSERT INTO DEVICEDATAQUERY(date_logged,time_stamp,recorded_value,element_name,user_id)
        VALUES(?,?,?,?,?)
                            ''',(date,timestamp,dataValue,dataName,userID))
        self.conn.commit()

    def get_saved_user_ids(self):
        self.cursor.execute('''
            SELECT DISTINCT(user_id)
                FROM DEVICEDATAQUERY
                            ''')
        rows = self.cursor.fetchall()
        return rows
        
    
    
