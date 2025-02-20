from langchain.prompts import ChatPromptTemplate,MessagesPlaceholder
from device_data_query import DeviceDataQuery
from create_health_summary import CreateHealthSummary
from pinecone_manager import PineconeManager
from configs import settings

class PromptGenerator:
    """
    Prompt Manager Class \n
    Handles creation of templates and prompts 
    """

    def __init__(self,deviceData : DeviceDataQuery ,healthSummary : CreateHealthSummary, pineconeManager: PineconeManager):
        #Load in user device data and health summary
        
        self.deviceData = deviceData
        self.healthSummary = healthSummary
        self.pineconeManager = pineconeManager
        self.completeDeviceSummary = ""
        self.completeStatsSummary = ""
        self.health_summary_prompts = settings["languageTuning"]

        # self.current_prompt_index = 0  # Start index for cycling through prompts
        self.completeHealthSummary  = ""
    
    def get_device_data(self) -> list[str]:
        return self.deviceData.get_device_data_as_strings()
    
    def get_stats_data(self): 
        return self.deviceData.get_stats_as_string()
    
    def get_health_summary(self) -> str:
        return self.healthSummary.get_health_summary_as_strings()

    def updateDeviceData(self, dataRange : int,dataResolution: int):
        self.deviceData = DeviceDataQuery(dataRange,dataResolution) 

    def generate_summarizer_prompt_devices(self,labData: str):
        """
        Generates prompt used to summarize numerical data from the device
        Returns a filled in prompt value 
        """
        template = ChatPromptTemplate([
            ("system", """Summarize the lab data provided, specify averages for all lab values.
             Make notes of any significant trends, peaks, and valleys in the data. Specify clearly which element u are currently summarizing.Keep summary short, Do Not Converse
             Do not show equations.  """),
            ("human", "{userInput}")
        ])
        
        return template.invoke(labData)
    
    
    def generate_stat_analysis_prompt_devices(self,stats):
        systemMessage = settings["statSum"]
        template = ChatPromptTemplate([
            ("system", systemMessage),
            ("human", "{userInput}")
        ])
        return template.invoke(stats)
    
    def generate_comparer(self,statanalysis,datasummary):
        input = "Here is the statistical analysis of all the recorded data" + statanalysis + "Here is the recent lab data summary" + datasummary
        template = ChatPromptTemplate([
                ("system", """Use the statistical analysis provided to make a comparison between recent recorded lab values and all recorded lab values.
                 Note changes from the average and other differences. Make notes of the recent recorded values are following trends or breaking the trends. """),
                ("human", "{userInput}")
            ])
        return template.invoke(input)
    
    def generate_summarizer_prompt_health(self,healthSummary: str):
        """
        Generates prompt used to summarize known health information of user
        Returns a filled in prompt value 
        """
        template = ChatPromptTemplate([
            ("system", """Provide an analysis of the patient based on the given health summary. Try to establish a  health profile of the patient
             make notes of habits that would impact the patients health  """),
            ("human", "{userInput}")
        ])
        return template.invoke(healthSummary)
    
    # def generate_stats_prompt_device(self,healthSummary: str):
    #     """
    #     Generates a prompt to read in statistical measurements of the users complete device data
    #     """
    #     template = ChatPromptTemplate([
    #         ("system", """Provide a complete analysis of the users health based off the given data. You are given a rolling window average and std of the device"""),
    #         ("human", "{userInput}")
    #     ])
    #     return template.invoke(healthSummary)
    
    def generate_health_summary_template(self) -> ChatPromptTemplate:
        """
        Compiles and formats a complete health summary  of the user. Putting together health summary and device data
        """
        template = ChatPromptTemplate([
            ("system", "This is the patients health summary"),
            ("human", "Here is my health summary and additional information about the patients diet" + self.completeHealthSummary),
            ("system", "This is a recent lab summary" + self.completeDeviceSummary),
            ("system", "This is an analysis of the trends of data grouped by hours and days. Use this to compare the patients most recent lab results to his averages and trends over time" + self.completeStatsSummary),
            #  ("system", "This is a comparison between the patients overall data vs recent values. Use this as reference when talking about trends or changes in the data" + self.completeStatsSummary),
            # ("human", "Here is the chat history" + self.history),
            # ("system", "This is the patients food log" + self.healthSummary.get_health_summary_as_string()),
        ])
        return template
    
    def generate_template(self):

        """
        Creates basic chat prompt template. The template will be the basic layout of a prompt used for the chatbot. \n
        The basic template consist of system messages telling the model how to act and also includes a completed health and device summary \n
        The template leaves user history and user input empty and will be filled in later
        """
        # First layer: Health Coach Identity and Analysis Framework
        coach_context = ChatPromptTemplate([
            ("system", self.health_summary_prompts),
           
        ])
        medical_context = self.generate_health_summary_template()

        # Final template with all layers
        template = ChatPromptTemplate([
            coach_context,
            medical_context,
            MessagesPlaceholder(variable_name="history", optional=True),
            ("human", "{userInput}")
        ])


        self.template = template

    def fill_chat_prompt(self, question = None,history = None):
        """
        Handles the insertion of user query into the chat template and updates the current chat history and stores it in the class 
        """
        template = self.template
        prompt = None
        context = self.pineconeManager.getContext(question)
        print("TEmplate error")
        prompt = template.invoke({
            "history" : history,
            "userInput": "\n Here is additional context based on the current users input. IF NOT RELEVENT IGNORE"  + context  + "\n Current User Input(ANSWER THIS USER QUESTION):"  + question
        })
        return prompt
        
