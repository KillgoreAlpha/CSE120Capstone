import os
import glob
import json
import pandas as pd
import sqlite3
from datetime import datetime


__db_file__ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "db_api_backend", "bin", "database", "testing.sqlite"))
print(__db_file__)

class devDataInsert():
    """
    Developer Class should not be accesible to user. Handles mass insertion of information to db. Keep private
    """
    def __init__(self):
        self.connect_to_db()
        # self.insert_device_data_bulk(('2024-10-21','01:06:47.539192',2,'Albumin',1))
        # self.insert_device_data_bulk(('2024-10-21','01:06:48.539192',4,'Albumin',1))
        # self.insert_device_data_bulk(('2024-10-21','01:06:49.539192',8,'Albumin',1))
        # self.insert_device_data_bulk(('2024-10-21','01:06:50.539192',55,'Albumin',1))
        # self.insert_device_data_bulk(('2024-10-21','01:06:51.539192',35,'Albumin',1))


    def connect_to_db(self):
        self.conn = sqlite3.connect(__db_file__)
        self.cursor = self.conn.cursor() 
    
    def insert_device_data_bulk(self, data_list):
        self.connect_to_db()
        self.cursor.execute('''
        INSERT INTO DeviceDataQuery(date_logged, time_stamp, recorded_value, element_name, user_id)
        VALUES(?,?,?,?,?)
        ''', data_list)
        self.conn.commit()
        self.conn.close()
        
    def insert_interstatial_fluid(self ,element_name, upper_limit = None, lower_limit = None, upper_critical_limit = None, lower_critical_limit = None):
        # Drop the table if it exists to ensure the schema is up-to-date
        self.cursor.execute('''
       insert into InterstitialFluidElement (element_name, upper_limit, lower_limit, upper_critical_limit, lower_critical_limit) values
        (?,?,?,?,?)
                            ''',(element_name, upper_limit, lower_limit, upper_critical_limit, lower_critical_limit))
        self.conn.commit()
    #
    def insert_user_info(self, name: str, age:int, gender, date_of_visit : str,previous_visits,is_smoker,weight,height,bmi):
        self.connect_to_db()
        self.cursor.execute('''

        INSERT INTO UserPersonalData (
            name, 
            age, 
            gender, 
            date_of_visit, 
            previous_visits, 
            is_smoker, 
            weight_kg, 
            height_cm, 
            bmi
        ) 
        VALUES (?,?,?,?,?,?,?,?,?);
        ''',(name,age,gender,date_of_visit,previous_visits,is_smoker,weight,height,bmi))
        self.conn.commit()
        self.conn.close()

    def load_json_data(self,file_path):
        with open(file_path, 'r') as f:
            data = json.load(f)
        # Extract readings and create a DataFrame
        readings = data["Readings"]
        df = pd.DataFrame(readings)
        return df
    
    def process_folder(self,directory):
        count = 0
        all_data = []  # List to hold data from each file

        # Iterate over each JSON file in the specified directory
        for file_path in glob.glob(f"{directory}/*.json"):
            count += 1
            # Load and process data from each file
            df = self.load_json_data(file_path)
            data_list = []
            dataName = df.columns[1]
            date_times = pd.to_datetime(df.iloc[:, 0])  # Convert the date column to datetime once

            # Prepare all records in one step
            data_list = list(zip(
                [dataName] * len(df),           # Repeat the dataName for all rows
                df.iloc[:, 1],                  # dataValue column
                date_times.dt.date.astype(str), # Extract dates as strings
                date_times.dt.time.astype(str), # Extract times as strings
                [1] * len(df)                   # userID, repeated
            ))
            print(dataName, count)
            self.insert_device_data_bulk(data_list)
            print(dataName, count)
            

    def process_all_subfolders(self,directory):
        subfolder_results = {}  # Dictionary to store results grouped by subfolder
        
        # Iterate over each subfolder in the main directory
        for subfolder_name in os.listdir(directory):
            subfolder_path = os.path.join(directory, subfolder_name)
            
            # Check if it's a directory
            if os.path.isdir(subfolder_path):
                # Process files in this subfolder
                
                subfolder_data = self.process_folder(subfolder_path)
                
                # Store the result in a dictionary with the subfolder name as the key
                subfolder_results[subfolder_name] = subfolder_data
           
        
        return subfolder_results
    

