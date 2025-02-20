from openai import OpenAI
import os
from pdf_reader import PdfUpdater
# from semantic_router.splitters import RollingWindowSplitter
from semantic_router.utils.logger import logger
from semantic_router.encoders import OpenAIEncoder
from semantic_router.schema import DocumentSplit
from dotenv import load_dotenv

class EmbeddingsCreator():
    """
    Generates embeddings used for vector database. Handles chunking and embedding of both user query and pdfs.
    All functions except enocde_input should not be accesible by user. 
    """
    def __init__(self):

        load_dotenv()
        logger.setLevel("WARNING")  # reduce logs from splitter
        self.encoder = OpenAIEncoder(name="text-embedding-3-small")
        self.encoder.score_threshold = 0.25
        """
        self.splitter = RollingWindowSplitter(
            encoder= self.encoder,
            dynamic_threshold=False,
            min_split_tokens=100,
            max_split_tokens=500,
            window_size=2,
            plot_splits=True,  # set this to true to visualize chunking
            enable_statistics=True  # to print chunking stats
        )
        """
        
    
    def build_chunk(self,title: str,content: str):
        return f"# {title} \n{content}"
    
    def build_metadata(self,title:str , id:int, doc_splits: list[DocumentSplit]):
        # get document level metadata first
        arxiv_id = id
        # init split level metadata list
        metadata = []
        for i, split in enumerate(doc_splits):
            # get neighboring chunks
            prechunk_id = "" if i == 0 else f"{arxiv_id}#{i-1}"
            postchunk_id = "" if i+1 == len(doc_splits) else f"{arxiv_id}#{i+1}"
            # create dict and append to metadata list
            metadata.append({
                "id": f"{arxiv_id}#{i}",
                "title": title,
                "content": split.content,
                "prechunk_id": prechunk_id,
                "postchunk_id": postchunk_id,
                "arxiv_id": arxiv_id
            })
        return metadata
    
    def populate_index(self):
        encoder = self.encoder
        splitter = self.splitter
        splitter.plot_splits = False

        pdfset = PdfUpdater().pdfs_to_text()
        batch_size = 128
        embeddings = []
        allIds = []
        metadatas = []
        for doc in pdfset:
            # create splits
            splits = splitter(doc[1])
            
            # create IDs and metadata for all splits in doc
            metadata = self.build_metadata(title = doc[0], id = doc[2], doc_splits=splits)
            for i in range(0, len(splits), batch_size):
                i_end = min(len(splits), i+batch_size)
                # get batch of data
                metadata_batch = metadata[i:i_end]
                # generate unique ids for each chunk
                ids = [m["id"] for m in metadata_batch]
                # get text content to embed
                content = [
                    self.build_chunk(
                        title=x["title"], content=x["content"]
                    ) for x in metadata_batch
                ]
                print("ALL Good")
                # embed text
                embeds = encoder(content)
                embeddings.append(embeds)
                allIds.append(ids)
                metadatas.append(metadata)
        return ((allIds, embeddings, metadatas))
    
    def encode_input(self,text: str):
        return self.encoder([text])

                
                
            
                    
