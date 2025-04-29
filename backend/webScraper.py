import os
import re
import time
import random
import requests
import pandas as pd
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime

class BiomarkerScraper:
    def __init__(self, output_dir="research_papers"):
        self.biomarkers = ["cortisol", "lactate", "uric acid", "crp", "il-6", "interleukin-6"]
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.output_dir = output_dir
        self.create_output_dir()
        self.results_df = pd.DataFrame(columns=["Title", "URL", "Abstract", "Biomarkers", "Has_Numerical_Data", "Date_Retrieved"])
        
    def create_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f"Created output directory: {self.output_dir}")
    
    def search_pubmed(self, query="inflammation biomarkers", max_results=50):
        # Search PubMed for relevant articles
        base_url = "https://pubmed.ncbi.nlm.nih.gov/"
        search_url = f"{base_url}?term={query.replace(' ', '+')}"
        
        print(f"Searching PubMed for: {query}")
        response = requests.get(search_url, headers=self.headers)
        
        if response.status_code != 200:
            print(f"Failed to fetch search results: {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        article_elements = soup.select(".docsum-content")
        
        results = []
        count = 0
        
        for article in article_elements:
            if count >= max_results:
                break
                
            title_elem = article.select_one(".docsum-title")
            if not title_elem:
                continue
                
            title = title_elem.text.strip()
            url = urljoin(base_url, title_elem.parent.get('href', ''))
            
            results.append({"title": title, "url": url})
            count += 1
            
        print(f"Found {len(results)} articles")
        return results
    
    def search_arxiv(self, query="inflammation biomarkers", max_results=50):
        # Search arXiv for relevant papers
        base_url = "https://export.arxiv.org/api/query"
        search_query = f"search_query=all:{query.replace(' ', '+')}&start=0&max_results={max_results}"
        
        print(f"Searching arXiv for: {query}")
        response = requests.get(f"{base_url}?{search_query}")
        
        if response.status_code != 200:
            print(f"Failed to fetch arXiv results: {response.status_code}")
            return []
            
        soup = BeautifulSoup(response.text, 'xml')
        entries = soup.find_all('entry')
        
        results = []
        for entry in entries:
            title = entry.find('title').text.strip()
            url = entry.find('id').text.strip()
            
            results.append({"title": title, "url": url})
            
        print(f"Found {len(results)} papers on arXiv")
        return results
    
    def fetch_paper_details(self, paper):
        print(f"Fetching details for: {paper['title'][:50]}...")
        
        try:
            response = requests.get(paper['url'], headers=self.headers)
            if response.status_code != 200:
                print(f"Failed to fetch paper details: {response.status_code}")
                return None
                
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Different websites have different structures
            abstract = None
            
            # Try PubMed structure
            if "pubmed" in paper['url']:
                abstract_elem = soup.select_one("#abstract")
                if abstract_elem:
                    abstract = abstract_elem.text.strip()
            
            # Try arXiv structure
            elif "arxiv" in paper['url']:
                abstract_elem = soup.select_one(".abstract")
                if abstract_elem:
                    abstract = abstract_elem.text.strip()
            
            # Generic fallback
            if not abstract:
                abstract_elems = soup.select(".abstract, #abstract, [name='abstract'], .paper-abstract")
                if abstract_elems:
                    abstract = abstract_elems[0].text.strip()
            
            return abstract
            
        except Exception as e:
            print(f"Error fetching paper details: {e}")
            return None
    
    def check_relevance(self, text):
        if not text:
            return False, []
            
        text_lower = text.lower()
        
        # Check for inflammation context
        has_inflammation = "inflammation" in text_lower or "inflammatory" in text_lower
        
        # Check for biomarkers
        found_biomarkers = []
        for biomarker in self.biomarkers:
            if biomarker in text_lower:
                found_biomarkers.append(biomarker)
        
        is_relevant = has_inflammation and len(found_biomarkers) > 0
        return is_relevant, found_biomarkers
    
    def has_numerical_data(self, text):
        if not text:
            return False
            
        # Look for patterns like: biomarker name + numbers with units further testing needed
        numerical_patterns = [
            r'\d+\s*(?:pg/ml|ng/ml|mg/l|μmol/l|mmol/l|μg/dl|mg/dl|pmol/l)',  # Units
            r'p\s*[<>=]\s*0\.\d+',  # p-values
            r'[+-]\s*\d+(?:\.\d+)?%',  # Percentage changes
            r'mean\s*[±:]\s*\d+(?:\.\d+)?',  # Mean values
            r'correlation coefficient\s*[=:]\s*\d+\.\d+'  # Correlation values
        ]
        
        for pattern in numerical_patterns:
            if re.search(pattern, text.lower()):
                return True
                
        # Check for tables (simplified)
        table_indicators = ['table', 'fig.', 'figure', 'chart', 'graph']
        for indicator in table_indicators:
            if indicator in text.lower():
                return True
                
        return False
    
    def download_paper(self, url, title, found_biomarkers):
        try:
            # Clean the title for use as filename
            clean_title = re.sub(r'[^\w\s-]', '', title)
            clean_title = re.sub(r'\s+', '_', clean_title)
            clean_title = clean_title[:100]  # Truncate long titles
            
            biomarker_tag = "-".join(found_biomarkers)
            filename = f"{clean_title}_{biomarker_tag}.pdf"
            filepath = os.path.join(self.output_dir, filename)
            
            # For demonstration, we're just saving the URL to a text file
            # In a real implementation, you would download the PDF
            with open(filepath.replace('.pdf', '.txt'), 'w', encoding='utf-8') as f:
                f.write(f"Paper Title: {title}\n")
                f.write(f"URL: {url}\n")
                f.write(f"Biomarkers: {', '.join(found_biomarkers)}\n")
                f.write(f"Downloaded on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            return True
        except Exception as e:
            print(f"Error downloading paper: {e}")
            return False
    
    def run(self, query="inflammation biomarkers", max_results=50):
        # Combine results from multiple sources
        all_papers = self.search_pubmed(f"{query}", max_results//2)
        all_papers.extend(self.search_arxiv(f"{query}", max_results//2))
        
        print(f"Processing {len(all_papers)} papers...")
        downloaded_count = 0
        
        for i, paper in enumerate(all_papers):
            print(f"Processing paper {i+1}/{len(all_papers)}")
            
            # Add random delay to be respectful to servers
            time.sleep(random.uniform(1, 3))
            
            abstract = self.fetch_paper_details(paper)
            if not abstract:
                continue
                
            is_relevant, found_biomarkers = self.check_relevance(abstract)
            if not is_relevant:
                continue
                
            has_numerical = self.has_numerical_data(abstract)
            if not has_numerical:
                continue
                
            # Stores the results with info basic stuff atm except for has numeracial data 
            self.results_df = pd.concat([self.results_df, pd.DataFrame([{
                "Title": paper['title'],
                "URL": paper['url'],
                "Abstract": abstract[:500] + "..." if abstract and len(abstract) > 500 else abstract,
                "Biomarkers": ", ".join(found_biomarkers),
                "Has_Numerical_Data": has_numerical,
                "Date_Retrieved": datetime.now().strftime('%Y-%m-%d')
            }])], ignore_index=True)
            
            download_success = self.download_paper(paper['url'], paper['title'], found_biomarkers)
            if download_success:
                downloaded_count += 1
                
            # Save progress after each successful download
            if downloaded_count % 5 == 0:
                self.save_results()
                
        self.save_results()
        print(f"Scraping complete! Downloaded {downloaded_count} relevant papers.")
        return downloaded_count
    
    def save_results(self):
        csv_path = os.path.join(self.output_dir, "scraping_results.csv")
        self.results_df.to_csv(csv_path, index=False)
        print(f"Results saved to {csv_path}")

if __name__ == "__main__":
    # Define search queries for different combinations
    search_queries = [
        "inflammation cortisol biomarker numerical data",
        "inflammation lactate biomarker research data",
        "inflammation uric acid biomarker clinical data",
        "inflammation CRP IL-6 biomarker correlation data",
        "skin biomarkers inflammation measurement data"
    ]
    
    scraper = BiomarkerScraper(output_dir="inflammation_biomarker_papers")
    
    total_downloaded = 0
    for query in search_queries:
        print(f"\n{'='*50}")
        print(f"Starting search for: {query}")
        print(f"{'='*50}")
        downloaded = scraper.run(query=query, max_results=20)
        total_downloaded += downloaded
        
    print(f"\nScraping completed! Total papers downloaded: {total_downloaded}")
    print(f"Results saved in the '{scraper.output_dir}' directory")