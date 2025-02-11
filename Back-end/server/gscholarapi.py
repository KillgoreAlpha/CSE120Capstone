import os
import requests
from pinecone_manager import PineconeManager
from scholarly import scholarly

def search_google_scholar(query, num_results=100):
    results = []
    try:
        search_query = scholarly.search_pubs(query)
        for i in range(num_results):
            publication = next(search_query, None)
            if not publication:
                break
            
            title = publication['bib']['title']
            url = publication.get('eprint_url', None)
            results.append({
                "title": title,
                "author": publication['bib']['author'],
                "abstract": publication['bib'].get('abstract', 'No abstract available'),
                "publication_year": publication['bib'].get('pub_year', 'Unknown'),
                "url": url if url else 'No URL available'
            })
    except Exception as e:
        print(f"An error occurred while searching: {e}")
    return results

def download_pdf(title, url, download_dir="../pdf_downloads"):
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
    
    if not url:
        print(f"No PDF URL available for: {title}")
        return
    
    try:
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            sanitized_title = "".join(c for c in title if c.isalnum() or c in " _-").rstrip()
            pdf_path = os.path.join(download_dir, f"{sanitized_title}.pdf")
            with open(pdf_path, 'wb') as pdf_file:
                for chunk in response.iter_content(chunk_size=1024):
                    pdf_file.write(chunk)
            print(f"Downloaded: {title} -> {pdf_path}")
        else:
            print(f"Failed to download PDF for: {title} (HTTP {response.status_code})")
    except Exception as e:
        print(f"Error downloading PDF for {title}: {e}")

def download_all_results(results):
    for result in results:
     print(result)
     if result["url"] != "No URL available":
         download_pdf(result["title"], result["url"])

def main():
    query = ""#insert search query here 
    download_all_results(search_google_scholar(query)) 
    pinecone = PineconeManager()
    pinecone.update_db()

if __name__ == "__main__":
   main()