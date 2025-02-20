# importing required modules
from pypdf import PdfReader
import os

class PdfUpdater():
    """
    Developer Class \n
    PDF reader class. Should not be accesed by user
    """

    # function to process all PDFs in a folder and compile them into a single array
    def process_pdfs_in_folder(self,folder_path):
        # list to hold text from all PDFs
        all_pdf_texts = []
        count = 0
        # iterate over all files in the folder
        for filename in os.listdir(folder_path):
            # check if the file is a PDF
            if filename.endswith(".pdf"):
                file_path = os.path.join(folder_path, filename)
                print(f"Processing file: {filename}")

                # create a pdf reader object
                reader = PdfReader(file_path)
                
                # initialize an empty string to hold the text from the current PDF
                full_text = ""
                
                title = reader.metadata.title
                # If the title is not present, use the filename instead
                if not title:
                    title = filename

                # iterate through each page in the PDF
                for page_num in range(len(reader.pages)):
                    # get the page object
                    page = reader.pages[page_num]
                    # extract text from the page and add to full_text
                    full_text += page.extract_text()
                    

                # append the full text string to the array
                full_text_wrap = [full_text]
                all_pdf_texts.append((title,full_text_wrap,count))
                count += 1
        print("PDF READ")
        return all_pdf_texts

    # main function to process all pdfs in a folder
    def pdfs_to_text(self):
        # provide the path to your folder containing PDF files
        folder_path = '../Back-end/importedData'

        # process all PDFs in the folder and get a list of text strings
        pdf_texts = self.process_pdfs_in_folder(folder_path)
        
        return pdf_texts
        
