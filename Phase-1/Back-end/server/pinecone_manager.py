from pinecone import Pinecone,ServerlessSpec
from embeddings_manager import EmbeddingsCreator
from cohere import Client
import getpass
import os
from dotenv import load_dotenv
import time

__top_n__ = 5
import requests

class PineconeManager():
    
    def __init__(self):
        # initialize connection to pinecone (get API key at app.pinecone.io)
        load_dotenv()

        #make sure to set back to
        api_key = os.getenv("PINECONE_API_KEY")
        self.co = Client(os.getenv('COHERE_API_KEY'))

        
        # configure client
        self.pc = Pinecone(api_key=api_key)
        self.spec = ServerlessSpec(
            cloud="aws", region="us-east-1"
        )
        
        self.connected = False
        if self.connect_to_vector_db():
            print("Connection Established")
            self.connected = True

        
    def connect_to_vector_db(self):
        pc = self.pc
        index_name = "x10v3"
        # check if index already exists (it shouldn't if this is first time)
        if index_name not in pc.list_indexes().names():
            # if does not exist, create index
            pc.create_index(
                index_name,
                dimension=1536,  # dimensionality of embed 3
                metric='cosine',
                spec=self.spec
            )
            # wait for index to be initialized
            while not pc.describe_index(index_name).status['ready']:
                time.sleep(1)

        # connect to index
        self.db = pc.Index(index_name)
        time.sleep(1)
        # view index stats
        self.db.describe_index_stats()
        return True
    
    #updates pinecone db with pdfs currently in folder
    def update_db(self):
        
        embedingCreate = EmbeddingsCreator()
        ids,embeddings,metadatas = embedingCreate.populate_index()

        for i in range(0,len(embeddings)):
            self.db.upsert(vectors=zip(ids[i], embeddings[i], metadatas[i]))
    
    #return relevant chunks based on text input
    def getContext(self, text: str): 
        db = self.db
        #encodes input
        
        xq = EmbeddingsCreator().encode_input(text)

        #find top 3 most relevent chunks of text
        matches = db.query(
            vector=xq,
            top_k=20,
            include_metadata=True
        )
        chunks = []
        for m in matches["matches"]:
            content = m["metadata"]["content"]
            title = m["metadata"]["title"]
            pre = m["metadata"]["prechunk_id"]
            post = m["metadata"]["postchunk_id"]
            try:
                other_chunks = db.fetch(ids=[pre, post])["vectors"]
                prechunk = other_chunks[pre]["metadata"]["content"]
                postchunk = other_chunks[post]["metadata"]["content"]
                chunk = f"""# {title}

                {prechunk[-400:]}
                {content}
                {postchunk[:400]}"""
                chunks.append(chunk)
            except Exception as err:
                print("Pinecone error")

        reranked = self.co.rerank(
            query=text,
            documents=chunks,
            top_n=__top_n__,
            return_documents=True
        )
        
        reChunk = ""

        for i in range(0, __top_n__):
            reChunk += reranked.results[i].document.text
            print(reranked.results[i].document.text)
        # print(reChunk)  
        return reChunk
    
# r = PineconeManager()
# r.update_db()