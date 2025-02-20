from llm_manager import LLMManager

from prompt_generator import PromptGenerator

class ChatManager(LLMManager):


    def __init__(self,promptGenerator : PromptGenerator,top_p = 1.00 ,temp = 1.00,p_pentalty = 0, f_pentalty = 0):
        super().__init__(promptGenerator,top_p,temp,p_pentalty, f_pentalty)
        self.promptGenerator.generate_template()
        self.history = []
        print("Template  generated.")

    
    def runChat(self,userInput :str) -> str:
        """
        Procceses user query and returns output from the model"""
        prompt = self.promptGenerator.fill_chat_prompt(question = userInput, history= self.history)
        answer = self.model.invoke(prompt).content         
        self.updateHistory(answer= answer, query= userInput)
        print("HISTORY \n" , self.history)
        return(answer)

    def updateHistory(self,answer = None, query = None):
        if(answer != None):
            self.history.append(("ai", answer))
        if(query != None):
            self.history.append(("human", query))
       

             