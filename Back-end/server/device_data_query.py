
import pandas as pd
import json
from data_manager import DataManager
from datetime import datetime

class DeviceDataQuery(DataManager):
    """
    Data Manager for handling numerical data from device. Pulls data from db and procceses into data frame for easier handling
    """
    def __init__(self,userId,start_time, end_time, resolution='1m'):
        """
        On intilization of class will automatically pull device data and process into data frames
        """

        self.connect_to_db()
        
        df,elementList = self.device_data_query(userId,start_time,end_time)
        df = df.drop(columns=['query_id'])
        
        #Resample data based off specified data resolution
        self.dfs = self.process_data(elementList=elementList,df=df,resolution = resolution)
        self.statdf = self.deviceDataTrends(userID=1,start_time= '2024-10-29')
        #Add additional tags detailing the range the recorded values fall into
        # for df in self.dfs:
        #     df['BoundStatus'] = df.apply(lambda x: self.compareHealthyRange(df['element_name'].iloc[0], x['recorded_value']), axis=1)
    
    
    def get_device_data_as_strings(self) -> list[str]:  
        deviceData = []
        for df in self.dfs:
            deviceData.append(df.to_string())
        return deviceData

    def get_stats_as_string(self): 
        statdf = self.statdf
        return ("Statistical analysis grouped by hour:" + statdf[0].to_string() + "Statistical analysis grouped by day:" + statdf[1].to_string() + "Users average across all time:" + statdf[2].to_string() + "Correlation between element by hour:" + statdf[3].to_string())
    
    def retrieveHealthyRanges(self,element: str) -> pd.DataFrame:
        """
        Returns the healthy bounds of a given element provided by the database
        """
        query = ('''
            Select * FROM InterstitialFluidElement
                WHERE element_name = ?
                            ''')
        return pd.read_sql_query(query, self.conn, params = [element])
        

    def compareHealthyRange(self, rowName: str, value: float):
            """
            Compares recorded values to healthy bounds of a given element
            """

            num_value = float(value)
            healthyBounds = self.retrieveHealthyRanges(rowName)
            
            lower_critical_limit = healthyBounds['lower_critical_limit'][0]
            lower_limit= healthyBounds['lower_limit'][0]
            upper_limit = healthyBounds['upper_limit'][0]
            upper_critical_limit = healthyBounds['upper_critical_limit'][0]
            
            if healthyBounds.isnull().any(axis=1).any():
                return 'N/A'
            
            if num_value < lower_critical_limit:
                result = "below critical range"
            elif num_value < lower_limit:
                result = "below healthy range"
            elif lower_limit <= num_value <= upper_limit:
                result = "within healthy range"
            elif upper_limit < num_value <= upper_critical_limit:
                result = "above healthy range"
            else:
                result = "above critical range"
            return f"({result})"
    
    def device_data_query(self,userID,start_time,end_time) -> pd.DataFrame: 
        """
        Pulls all device data recorded from given time range
        """

        start = datetime.strptime(start_time, "%Y-%m-%d")
        end = datetime.strptime(end_time, "%Y-%m-%d")
        self.cursor.execute(''' select Distinct(element_name) FROM DEVICEDATAQUERY''')
        elements = self.cursor.fetchall()
        query = ('''
        SELECT * 
        FROM DEVICEDATAQUERY
        WHERE ? < date_logged
        AND ? > date_logged 
        AND user_id = ?
        ''')
        return (pd.read_sql_query(query, self.conn, params = (start,end,userID)),elements)
    
    def process_data(self,elementList,df, resolution='1h') -> list[pd.DataFrame]:
        """
        Resamples data based off specified resolution, takes in the mean of each sample
        """

        df['date_time'] = pd.to_datetime(df['date_logged'] + 'T' + df['time_stamp'])
        dfs = []
        for element in elementList:
            
            filtered_df = df[df['element_name'] == element[0]]
            
            filtered_df.set_index('date_time', inplace=True)
            
            filtered_df = filtered_df.select_dtypes(include=['number'])

            # Resample and calculate the mean of numeric columns
            filtered_df = filtered_df.resample(resolution).mean().dropna()
            filtered_df['element_name'] = element[0]
            dfs.append(filtered_df)
        return dfs
        
    def deviceDataTrends(self,start_time,userID):

        #User historic average by day
        query = ('''
        SELECT date_logged,element_name, AVG(recorded_value) as recorded_value , 
        (SUM(CAST(recorded_value * recorded_value AS REAL)) / CAST(COUNT(recorded_value) AS REAL)) - 
        (SUM(CAST(recorded_value AS REAL)) * SUM(CAST(recorded_value AS REAL))) / 
        (CAST(COUNT(recorded_value) AS REAL) * CAST(COUNT(recorded_value) AS REAL)) AS variance
        FROM DEVICEDATAQUERY
        WHERE ? > date_logged
        AND user_id = ?
        GROUP BY date_logged, element_name
        ''')
        
        dfAvgByDay =  pd.read_sql_query(query, self.conn, params = (start_time,userID))
        # Calculate moving average by 'element'
        dfAvgByDay['moving_average'] = dfAvgByDay.groupby('element_name')['recorded_value'].rolling(window=2).mean().reset_index(level=0, drop=True)
        dfAvgByDay['rolling_std_dev'] = dfAvgByDay.groupby('element_name')['recorded_value'].rolling(window=2).std().reset_index(level=0, drop=True)
    
        
        # User historic average by hour of the day 
        query = ('''
        SELECT strftime('%H:00:00', time_stamp) as hours,element_name, AVG(recorded_value) as recorded_value,
        (SUM(CAST(recorded_value * recorded_value AS REAL)) / CAST(COUNT(recorded_value) AS REAL)) - 
        (SUM(CAST(recorded_value AS REAL)) * SUM(CAST(recorded_value AS REAL))) / 
        (CAST(COUNT(recorded_value) AS REAL) * CAST(COUNT(recorded_value) AS REAL)) AS variance
        FROM DEVICEDATAQUERY
        WHERE ? > date_logged
        AND user_id = ?
        GROUP BY hours, element_name
        ''')
        dfAvgByHour =  pd.read_sql_query(query, self.conn, params = (start_time,userID))
        # Calculate moving average and std by 'element'
        dfAvgByHour['moving_average'] = dfAvgByHour.groupby('element_name')['recorded_value'].rolling(window=2).mean().reset_index(level=0, drop=True)
        dfAvgByHour['rolling_std_dev'] = dfAvgByHour.groupby('element_name')['recorded_value'].rolling(window=2).std().reset_index(level=0, drop=True)
        
        # Calculate correlation between elements
        corr = dfAvgByHour.pivot(index='hours', columns='element_name', values='recorded_value').corr()
        
        corrByHour = corr.reset_index().melt(
            id_vars='element_name',
            var_name='correlated_with',
            value_name='correlation'
        )
        
        # Filter out redundant rows (e.g., A->B and B->A)
        corrByHour = corrByHour[corrByHour['element_name'] < corrByHour['correlated_with']]
        
        #User historic average 
        query = ('''
        SELECT element_name, AVG(recorded_value)as recorded_value,
        (SUM(CAST(recorded_value * recorded_value AS REAL)) / CAST(COUNT(recorded_value) AS REAL)) - 
        (SUM(CAST(recorded_value AS REAL)) * SUM(CAST(recorded_value AS REAL))) / 
        (CAST(COUNT(recorded_value) AS REAL) * CAST(COUNT(recorded_value) AS REAL)) AS variance
        FROM DEVICEDATAQUERY
        WHERE ? > date_logged
        AND user_id = ?
        GROUP BY element_name
        ''')
        
        dfAvgHist =  pd.read_sql_query(query, self.conn, params = (start_time,userID))
        return((dfAvgByDay,dfAvgByHour,dfAvgHist,corrByHour))
      
        
       

        
        
       
     
        
        
        
    
    
# deviceDataQuery = DeviceDataQuery(userId=1,start_time= '2024-10-29',end_time= '2024-10-26',resolution= '1h')
# deviceDataQuery.deviceDataTrends(userID=1,start_time= '2024-10-29')