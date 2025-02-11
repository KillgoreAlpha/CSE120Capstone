from langchain_openai import ChatOpenAI
from prompt_generator import PromptGenerator
from pinecone_manager import PineconeManager
from dotenv import load_dotenv
from configs import settings


class LLMManager(): 
    def __init__(self,promptGenerator : PromptGenerator,top_p = 1.00 ,temp = 1.00,p_pentalty = 0, f_pentalty = 0):

        self.model = ChatOpenAI(model = "gpt-4o-mini", verbose= True,top_p = top_p,temperature= temp,presence_penalty= p_pentalty,frequency_penalty= f_pentalty)
        self.promptGenerator = promptGenerator


    def update_paramaters(self,top_p = 1.00 ,temp = 1.00,p_pentalty = 0, f_pentalty = 0):
        self.model = ChatOpenAI(model = "gpt-4o-mini", verbose= True,top_p = top_p,temperature= temp,presence_penalty= p_pentalty,frequency_penalty= f_pentalty)
    
    def summarizeDeviceData(self) -> None:
        """
        Summarizes and updates device and health summary and updates directly to prompt_generator
        """
        # pull unformatted device and health data from prompt_generator
        arrayOfDeviceData = self.promptGenerator.get_device_data()
        healthSummary = self.promptGenerator.get_health_summary()
        statsSummary = self.promptGenerator.get_stats_data()

        completeDeviceSummary = ""
        count = 0

        #summarizes through unformatted health data
        completeHealthSummary = self.model.invoke(self.promptGenerator.generate_summarizer_prompt_health(healthSummary)).content + "\n" 

        #complete user device trends summary
        completeStatsSummary = self.model.invoke(self.promptGenerator.generate_stat_analysis_prompt_devices(statsSummary)).content 
        

        #iterates through each element from deivce data and generates summary
        for data in arrayOfDeviceData:
            print("Analyzing Device Data", count, "/19")
            completeDeviceSummary += self.model.invoke(self.promptGenerator.generate_summarizer_prompt_devices(data)).content
            count += 1
        
        
        
        
        #updates prompt_generator with completed summaries
        self.promptGenerator.completeDeviceSummary = completeDeviceSummary
        self.promptGenerator.completeHealthSummary  = completeHealthSummary
        self.promptGenerator.completeStatsSummary  = completeStatsSummary    








