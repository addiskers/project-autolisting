import scrapy
from scrapy import Request


class WebSpider(scrapy.Spider):
    name = "web"
    allowed_domains = ["phoenixtapware.com.au"]

    def start_requests(self):
        base_url = "https://www.phoenixtapware.com.au/products/?page={}"
        
        for page in range(1, 3):  
            yield Request(
                url=base_url.format(page),
                callback=self.parse,
                meta={
                    "zyte_api_automap": {
                        "browserHtml": True,
                    },
                },
            )

    def parse(self, response):
        product_links = response.css('.single-product-tile a[href*="/product/"]::attr(href)').getall()
        
        seen = set()
        unique_links = []
        for link in product_links:
            if link not in seen:
                seen.add(link)
                unique_links.append(link)
        
        for link in unique_links:
            absolute_url = response.urljoin(link)
            yield {
                'product_url': absolute_url,
            }
            
        self.logger.info(f"Found {len(unique_links)} unique product links on {response.url}")