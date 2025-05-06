import os
import re
import time
import random
import requests
import pandas as pd
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
from datetime import datetime
import xml.etree.ElementTree as ET  # Using built-in XML parser
import json
import hashlib

class BiomarkerScraper:
    def __init__(self, output_dir="research_papers"):
        self.biomarkers = ["cortisol", "lactate", "uric acid", "crp", "il-6", "interleukin-6"]
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.output_dir = output_dir
        self.create_output_dir()
        self.results_df = pd.DataFrame(columns=["Title", "URL", "Abstract", "Biomarkers", "Has_Numerical_Data", "Date_Retrieved", "Source", "Paper_ID"])
        self.debug_mode = True  # Set to True to enable debug output
        
        # Load previously processed papers if exists
        self.paper_registry_file = os.path.join(output_dir, "paper_registry.json")
        self.consolidated_file = os.path.join(output_dir, "consolidated_papers.txt")
        self.processed_papers = self.load_paper_registry()
        
    def debug_print(self, message):
        """Print debug messages if debug mode is enabled"""
        if self.debug_mode:
            print(f"[DEBUG] {message}")
    
    def create_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f"Created output directory: {self.output_dir}")
    
    def load_paper_registry(self):
        """Load the registry of processed papers from a JSON file"""
        if os.path.exists(self.paper_registry_file):
            try:
                with open(self.paper_registry_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading paper registry: {e}")
                return {}
        else:
            return {}
    
    def save_paper_registry(self):
        """Save the registry of processed papers to a JSON file"""
        try:
            with open(self.paper_registry_file, 'w', encoding='utf-8') as f:
                json.dump(self.processed_papers, f, indent=2)
            print(f"Paper registry saved to {self.paper_registry_file}")
        except Exception as e:
            print(f"Error saving paper registry: {e}")
    
    def generate_paper_id(self, paper):
        """Generate a unique ID for a paper based on its URL and title"""
        unique_string = f"{paper['url']}_{paper['title']}"
        return hashlib.md5(unique_string.encode()).hexdigest()
    
    def is_paper_processed(self, paper_id):
        """Check if a paper has already been processed"""
        return paper_id in self.processed_papers
    
    def search_pubmed(self, query="inflammation biomarkers", max_results=50):
        """Search PubMed for relevant articles using E-utilities API instead of web scraping"""
        # Use E-utilities API which is more reliable than web scraping
        base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
        
        # Step 1: Search for IDs
        search_url = f"{base_url}esearch.fcgi?db=pubmed&term={quote(query)}&retmax={max_results}&usehistory=y&retmode=json"
        
        print(f"Searching PubMed for: {query}")
        self.debug_print(f"Using URL: {search_url}")
        
        try:
            response = requests.get(search_url, headers=self.headers)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            if response.status_code != 200:
                print(f"Failed to fetch PubMed search results: {response.status_code}")
                return []
            
            search_data = response.json()
            self.debug_print(f"PubMed search response: {search_data.keys()}")
            
            # Extract IDs
            ids = search_data.get('esearchresult', {}).get('idlist', [])
            if not ids:
                print("No PubMed IDs found in search results")
                return []
                
            self.debug_print(f"Found {len(ids)} PubMed IDs")
            
            # Step 2: Fetch summaries for these IDs
            id_string = ",".join(ids)
            summary_url = f"{base_url}esummary.fcgi?db=pubmed&id={id_string}&retmode=json"
            
            summary_response = requests.get(summary_url, headers=self.headers)
            summary_response.raise_for_status()
            
            if summary_response.status_code != 200:
                print(f"Failed to fetch PubMed summaries: {summary_response.status_code}")
                return []
                
            summary_data = summary_response.json()
            
            # Parse results
            results = []
            for id in ids:
                try:
                    article_data = summary_data.get('result', {}).get(id, {})
                    
                    if not article_data:
                        continue
                        
                    title = article_data.get('title', '').strip()
                    
                    if not title:
                        continue
                        
                    # Create PubMed URL
                    url = f"https://pubmed.ncbi.nlm.nih.gov/{id}/"
                    
                    abstract = article_data.get('abstract', '')
                    
                    paper = {
                        "title": title,
                        "url": url,
                        "abstract": abstract,  # Pre-fetch the abstract when available
                        "source": "pubmed"
                    }
                    
                    # Generate a unique ID for this paper
                    paper["id"] = self.generate_paper_id(paper)
                    
                    # Check if we've already processed this paper
                    if self.is_paper_processed(paper["id"]):
                        self.debug_print(f"Skipping already processed PubMed paper: {title[:50]}...")
                        continue
                    
                    results.append(paper)
                except Exception as e:
                    print(f"Error processing PubMed article {id}: {e}")
            
            print(f"Found {len(results)} new articles from PubMed")
            return results
            
        except Exception as e:
            print(f"Error in PubMed search: {e}")
            return []
    
    def search_arxiv(self, query="inflammation biomarkers", max_results=50):
        """Search arXiv using their API and parse the XML response properly"""
        base_url = "https://export.arxiv.org/api/query"
        search_query = f"search_query=all:{quote(query)}&start=0&max_results={max_results}"
        
        print(f"Searching arXiv for: {query}")
        self.debug_print(f"Using URL: {base_url}?{search_query}")
        
        try:
            response = requests.get(f"{base_url}?{search_query}")
            response.raise_for_status()
            
            if response.status_code != 200:
                print(f"Failed to fetch arXiv results: {response.status_code}")
                return []
            
            # Use ElementTree to parse XML properly instead of BeautifulSoup
            root = ET.fromstring(response.content)
            
            # Define namespace
            namespace = {'atom': 'http://www.w3.org/2005/Atom'}
            
            # Find all entry elements
            entries = root.findall('.//atom:entry', namespace)
            
            results = []
            for entry in entries:
                try:
                    title_elem = entry.find('./atom:title', namespace)
                    id_elem = entry.find('./atom:id', namespace)
                    summary_elem = entry.find('./atom:summary', namespace)
                    
                    if title_elem is not None and id_elem is not None:
                        title = title_elem.text.strip()
                        arxiv_url = id_elem.text.strip()
                        
                        # Extract abstract if available
                        abstract = ""
                        if summary_elem is not None:
                            abstract = summary_elem.text.strip()
                        
                        paper = {
                            "title": title,
                            "url": arxiv_url,
                            "abstract": abstract,  # Pre-fetch the abstract when available
                            "source": "arxiv"
                        }
                        
                        # Generate a unique ID for this paper
                        paper["id"] = self.generate_paper_id(paper)
                        
                        # Check if we've already processed this paper
                        if self.is_paper_processed(paper["id"]):
                            self.debug_print(f"Skipping already processed arXiv paper: {title[:50]}...")
                            continue
                        
                        results.append(paper)
                except Exception as e:
                    print(f"Error parsing arXiv entry: {e}")
                    continue
            
            print(f"Found {len(results)} new papers on arXiv")
            return results
            
        except Exception as e:
            print(f"Error in arXiv search: {e}")
            return []
    
    def fetch_paper_details(self, paper):
        """Fetch additional details for papers if abstract isn't already fetched"""
        # If we already have the abstract, return it
        if paper.get('abstract'):
            self.debug_print(f"Using pre-fetched abstract for: {paper['title'][:50]}...")
            return paper['abstract']
            
        print(f"Fetching details for: {paper['title'][:50]}...")
        
        try:
            response = requests.get(paper['url'], headers=self.headers, timeout=10)
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
                    
                # Alternative PubMed selectors
                if not abstract:
                    abstract_selectors = [
                        ".abstract-content",
                        ".abstract-text",
                        "[data-ga-label='abstract']"
                    ]
                    for selector in abstract_selectors:
                        elem = soup.select_one(selector)
                        if elem:
                            abstract = elem.text.strip()
                            break
            
            # Try arXiv structure
            elif "arxiv" in paper['url']:
                abstract_elem = soup.select_one(".abstract, .abstract-full")
                if abstract_elem:
                    abstract = abstract_elem.text.strip()
                    # Remove "Abstract: " prefix if present
                    abstract = re.sub(r'^Abstract:\s*', '', abstract, flags=re.IGNORECASE)
            
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
        """Check if paper is relevant based on biomarkers and inflammation context"""
        if not text:
            self.debug_print("No text provided for relevance check")
            return False, []
            
        text_lower = text.lower()
        
        # Check for inflammation context - more flexible
        inflammation_terms = ["inflammation", "inflammatory", "inflamed", "immune response", "cytokine"]
        has_inflammation = any(term in text_lower for term in inflammation_terms)
        
        # Check for biomarkers
        found_biomarkers = []
        for biomarker in self.biomarkers:
            if biomarker in text_lower:
                found_biomarkers.append(biomarker)
        
        # More flexible relevance check - either has inflammation terms or biomarkers
        is_relevant = has_inflammation or len(found_biomarkers) > 0
        
        if not is_relevant:
            self.debug_print(f"Paper not relevant: inflammation={has_inflammation}, biomarkers={found_biomarkers}")
        
        return is_relevant, found_biomarkers
    
    def has_numerical_data(self, text):
        """Check if the abstract contains numerical data related to measurements"""
        if not text:
            return False
            
        # More comprehensive patterns for numerical data
        numerical_patterns = [
            r'\d+\s*(?:pg/ml|ng/ml|mg/l|μmol/l|mmol/l|μg/dl|mg/dl|pmol/l)',  # Units
            r'p\s*[<>=]\s*0\.\d+',  # p-values
            r'[+-]?\s*\d+(?:\.\d+)?%',  # Percentage values
            r'mean\s*[±:]\s*\d+(?:\.\d+)?',  # Mean values
            r'\d+(?:\.\d+)?\s*±\s*\d+(?:\.\d+)?',  # Values with standard deviations
            r'correlation\s*(?:coefficient)?\s*[=:]\s*[+-]?\d+\.\d+',  # Correlation values
            r'(?:concentration|level)s?\s*(?:of|were|was)\s*\d+(?:\.\d+)?',  # Concentration statements
            r'\d+\s*(?:patients|subjects|participants)',  # Sample sizes
            r'(?:significantly|considerably)\s*(?:higher|lower|increased|decreased)',  # Statistical significance terms
            r'fold[- ]?change',  # Fold change
            r'hazard ratio',  # Statistical measures
            r'confidence interval',  # Statistical measures
            r'odds ratio'  # Statistical measures
        ]
        
        for pattern in numerical_patterns:
            if re.search(pattern, text.lower()):
                return True
                
        # Check for tables and figures
        table_indicators = ['table', 'fig.', 'figure', 'chart', 'graph', 'plot', 'diagram', 'data shown']
        for indicator in table_indicators:
            if indicator in text.lower():
                return True
                
        return False
    
    def add_paper_to_consolidated_file(self, paper_data):
        """Add paper information to a consolidated text file instead of individual files"""
        try:
            with open(self.consolidated_file, 'a', encoding='utf-8') as f:
                f.write("\n" + "="*80 + "\n")
                f.write(f"Paper Title: {paper_data['title']}\n")
                f.write(f"URL: {paper_data['url']}\n")
                f.write(f"Source: {paper_data['source']}\n")
                f.write(f"Biomarkers: {paper_data['biomarkers']}\n")
                f.write(f"Has Numerical Data: {paper_data['has_numerical']}\n")
                f.write(f"Date Retrieved: {paper_data['date_retrieved']}\n")
                f.write("-"*40 + " ABSTRACT " + "-"*40 + "\n")
                f.write(f"{paper_data['abstract']}\n")
                
            return True
        except Exception as e:
            print(f"Error adding paper to consolidated file: {e}")
            return False
    
    def process_paper(self, paper):
        """Process a single paper and add to registry if relevant"""
        paper_id = paper.get("id") or self.generate_paper_id(paper)
        
        # Skip if already processed
        if self.is_paper_processed(paper_id):
            print(f"Skipping already processed paper: {paper['title'][:50]}...")
            return False
        
        # Get abstract if not already fetched
        abstract = paper.get('abstract') or self.fetch_paper_details(paper)
        if not abstract:
            print("No abstract found, skipping...")
            return False
            
        # Print first 100 chars of abstract for debugging
        self.debug_print(f"Abstract preview: {abstract[:100]}...")
            
        is_relevant, found_biomarkers = self.check_relevance(abstract)
        if not is_relevant:
            print("Paper not relevant for this query, skipping...")
            return False
            
        has_numerical = self.has_numerical_data(abstract)
        if not has_numerical:
            print("No numerical data found, skipping...")
            return False
        
        print(f"Paper is relevant! Found biomarkers: {', '.join(found_biomarkers)}")
        print(f"Numerical data: {'Yes' if has_numerical else 'No'}")
            
        # Store the paper in the registry
        paper_data = {
            "title": paper['title'],
            "url": paper['url'],
            "abstract": abstract,
            "biomarkers": ", ".join(found_biomarkers) if found_biomarkers else "None detected",
            "has_numerical": has_numerical,
            "date_retrieved": datetime.now().strftime('%Y-%m-%d'),
            "source": paper.get('source', 'unknown')
        }
        
        # Add to consolidated file
        self.add_paper_to_consolidated_file(paper_data)
        
        # Add to registry to avoid reprocessing
        self.processed_papers[paper_id] = {
            "title": paper['title'],
            "url": paper['url'],
            "date_retrieved": datetime.now().strftime('%Y-%m-%d'),
            "source": paper.get('source', 'unknown')
        }
        
        # Store in DataFrame for CSV export
        self.results_df = pd.concat([self.results_df, pd.DataFrame([{
            "Title": paper['title'],
            "URL": paper['url'],
            "Abstract": abstract[:500] + "..." if abstract and len(abstract) > 500 else abstract,
            "Biomarkers": ", ".join(found_biomarkers) if found_biomarkers else "None detected",
            "Has_Numerical_Data": has_numerical,
            "Date_Retrieved": datetime.now().strftime('%Y-%m-%d'),
            "Source": paper.get('source', 'unknown'),
            "Paper_ID": paper_id
        }])], ignore_index=True)
        
        return True
    
    def run(self, query="inflammation biomarkers", max_results=50):
        """Run the scraper with the given query"""
        try:
            # Create consolidated file if it doesn't exist
            if not os.path.exists(self.consolidated_file):
                with open(self.consolidated_file, 'w', encoding='utf-8') as f:
                    f.write("CONSOLIDATED BIOMARKER RESEARCH PAPERS\n")
                    f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    f.write(f"Query: {query}\n")
                    f.write("="*80 + "\n")
            
            # Combine results from multiple sources
            print("\nSearching PubMed...")
            pubmed_papers = self.search_pubmed(f"{query}", max_results//2)
            
            print("\nSearching arXiv...")
            arxiv_papers = self.search_arxiv(f"{query}", max_results//2)
            
            all_papers = pubmed_papers + arxiv_papers
            
            if not all_papers:
                print("No new papers found from either source!")
                return 0
                
            print(f"\nProcessing {len(all_papers)} papers...")
            processed_count = 0
            
            for i, paper in enumerate(all_papers):
                print(f"\nProcessing paper {i+1}/{len(all_papers)}: {paper['title'][:50]}...")
                
                # Add random delay to be respectful to servers
                time.sleep(random.uniform(1, 2))
                
                if self.process_paper(paper):
                    processed_count += 1
                    print(f"Successfully added paper to consolidated file")
                    
                # Save progress periodically
                if processed_count % 5 == 0:
                    self.save_results()
                    self.save_paper_registry()
                    
            self.save_results()
            self.save_paper_registry()
            print(f"\nScraping complete! Processed {processed_count} relevant papers.")
            return processed_count
            
        except Exception as e:
            print(f"Error during scraping: {e}")
            self.save_results()  # Save whatever results we have
            self.save_paper_registry()
            return 0
    
    def save_results(self):
        """Save results to CSV file"""
        csv_path = os.path.join(self.output_dir, "scraping_results.csv")
        self.results_df.to_csv(csv_path, index=False)
        print(f"Results saved to {csv_path}")
        
        # Print a summary of sources
        if not self.results_df.empty:
            source_counts = self.results_df['Source'].value_counts()
            print("\nResults by source:")
            for source, count in source_counts.items():
                print(f"- {source}: {count} papers")

def main():
    """Main function to run the scraper"""
    # Define search queries for different combinations - make them more general
    search_queries = [
        "inflammation biomarker",  # More general query
        "cortisol inflammation", 
        "lactate inflammation",
        "CRP IL-6 inflammation",
        "skin inflammation biomarkers"
    ]
    
    # Create scraper with a single output directory
    output_dir = "biomarker_research"
    scraper = BiomarkerScraper(output_dir=output_dir)
    
    # Process each query
    total_processed = 0
    for query in search_queries:
        print(f"\n{'='*50}")
        print(f"Starting search for: {query}")
        print(f"{'='*50}")
        
        # Run with fewer results per query to avoid rate limiting
        processed = scraper.run(query=query, max_results=10)
        total_processed += processed
        
        # Add a pause between queries
        if query != search_queries[-1]:  # If not the last query
            delay = random.uniform(5, 10)
            print(f"\nPausing for {delay:.1f} seconds before next query...")
            time.sleep(delay)
        
    print(f"\nScraping completed! Total papers processed: {total_processed}")
    print(f"All results saved in the '{output_dir}' directory")
    print(f"Consolidated paper information is available in: {scraper.consolidated_file}")
    print(f"CSV data is available in: {os.path.join(output_dir, 'scraping_results.csv')}")

if __name__ == "__main__":
    main()