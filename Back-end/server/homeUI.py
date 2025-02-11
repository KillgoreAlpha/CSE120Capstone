from pinecone_manager import PineconeManager
from chat_manager import ChatManager
from create_health_summary import CreateHealthSummary
from device_data_query import DeviceDataQuery
from dev_insert_data import devDataInsert
from data_manager import DataManager
from prompt_generator import PromptGenerator
from dotenv import load_dotenv
import csv
import os

__TESTSETPATH__ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "importedData", "questions_and_answers_100_fixed.csv"))
__USERID__ = 1

class HomeUI():
    def __init__(self,start_time,end_time,dataResolution):
        load_dotenv()
        self.chats = {}
        self.profiles = {}
        self.default_start_time = start_time
        self.default_end_time = end_time
        self.default_data_resolution = dataResolution
        self.loadExistingUsers()
        print("STARTUP FINISHED")

    def loadExistingUsers(self):
        users = DataManager().get_saved_user_ids()
        for user in users:
            self.generateUserProfiles(user[0])
        
    
    def generateUserProfiles(self,userId):
        pineConeManager=  PineconeManager()
        deviceDataQuery = DeviceDataQuery(userId=userId,start_time = self.default_start_time , end_time= self.default_end_time ,resolution = self.default_data_resolution)
        createHealthSummary = CreateHealthSummary(userId= userId)
        promptGenerator = PromptGenerator(deviceDataQuery,createHealthSummary,pineConeManager)
        self.profiles[userId] = promptGenerator
        summarizer = ChatManager(promptGenerator)
        summarizer.summarizeDeviceData()

    def runChat(self,chatId,message,userId) -> str:
        if userId not in self.profiles:
            self.generateUserProfiles(userId)
        if chatId not in self.chats:
            self.chats[chatId] = ChatManager(self.profiles[userId])

        return self.chats[chatId].runChat(message)

  

hui = HomeUI(start_time= '2024-10-21',end_time= '2024-10-22',dataResolution= '1h')
# hui.runChat()