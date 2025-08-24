import scrapy
from scrapy import Request
import json
import re

class ProductSpider(scrapy.Spider):
    name = "product"
    allowed_domains = ["phoenixtapware.com.au"]

    def start_requests(self):
        url = "https://www.phoenixtapware.com.au/product/enviro316-sink-mixer-240mm-squareline/?finish=ss"
        yield Request(
            url=url,
            callback=self.parse,
            meta={
                "zyte_api_automap": {
                    "browserHtml": True,
                },
            },
        )

    def clean_text(self, text):
        return re.sub(r"\s+", " ", text or "").strip()

    def parse(self, response):
        title = self.clean_text(response.css("h1.product_title.entry-title::text").get()) or None

        # SKU with fallback
        sku = self.clean_text(response.css("div.sku::text").get())
        if not sku:
            sku = self.clean_text(response.css("p.js-sku::text").get())
        sku = sku or None

        main_color = self.clean_text(response.css("div.js-finish-label a::text").get()) or None
        status = self.clean_text(
            response.xpath(
                "normalize-space(//div[contains(@class,'js-stock-info')]//span/span/text())"
            ).get()
        ) or None
       
        # BREADCRUMBS 
        breadcrumbs = []
        all_breadcrumb_texts = response.css("#breadcrumbs a::text, #breadcrumbs .breadcrumb_last::text").getall()
        seen = set()
        for text in all_breadcrumb_texts:
            cleaned = self.clean_text(text)
            if cleaned and cleaned not in seen:
                breadcrumbs.append(cleaned)
                seen.add(cleaned)
        breadcrumbs = breadcrumbs if breadcrumbs else None
        
        #CATEGORY
        category = breadcrumbs[1] if breadcrumbs else None

        # DESCRIPTION
        description = [
            self.clean_text(" ".join(li.css("::text").getall()))
            for li in response.css(".woocommerce-product-details__short-description li")
        ]
        description = [d for d in description if d]
        description = description if description else None

        # FEATURES
        features = [
            self.clean_text(" ".join(li.css("::text").getall()))
            for li in response.css(".rich-content li")
        ]
        features = [f for f in features if f]
        features = features if features else None

        # COLORS
        colors = [
            self.clean_text(c)
            for c in response.css("#picker_pa_finish option::text").getall()
            if c.strip()
        ]
        colors = colors if colors else None

        # PRESSURE RATING
        pressure_rating_texts = response.xpath("//h4[contains(., 'Pressure Rating')]/following-sibling::div//text()").getall()
        pressure_rating = self.clean_text(" ".join(pressure_rating_texts)) or None

        # TEMPERATURE RATING
        temperature_rating_texts = response.xpath("//h4[contains(., 'Temperature Rating')]/following-sibling::div//text()").getall()
        temperature_rating = self.clean_text(" ".join(temperature_rating_texts)) or None

        # WARRANTY (multiple lines)
        warranty_lines = [
            self.clean_text(t)
            for t in response.xpath("//h4[contains(., 'Warranty')]/following-sibling::div//text()").getall()
            if t.strip()
        ]
        warranty = warranty_lines if warranty_lines else None

        # -------- WELS FIELDS --------
        wels_block_text = " ".join(
            response.xpath("//h4[contains(., 'WELS Rating')]/following-sibling::div//text()").getall()
        )
        wels_block_text = self.clean_text(wels_block_text)

        # WELS Rating (only star)
        wels_rating = None
        if wels_block_text:
            m_star = re.search(r"(\d+)\s*star", wels_block_text, flags=re.IGNORECASE)
            if m_star:
                wels_rating = f"{m_star.group(1)} star"

        # Flow Rate (normalize lt/min or l/min -> "X L/min")
        flow_rate = None
        if wels_block_text:
            m_flow = re.search(r"([\d.]+)\s*(?:l|lt)\s*/?\s*min", wels_block_text, flags=re.IGNORECASE)
            if m_flow:
                flow_rate = f"{m_flow.group(1)} L/min"

        # WELS Reg. No.
        wels_reg_no = self.clean_text(response.css("span.js-wels::text").get())
        if not wels_reg_no and wels_block_text:
            m_reg = re.search(r"REG\s*NO\.?\s*([A-Za-z0-9\-]+)", wels_block_text, flags=re.IGNORECASE)
            if m_reg:
                wels_reg_no = m_reg.group(1)
        wels_reg_no = wels_reg_no or None

        images = response.css(".product-gallery__thumb-slide img::attr(src)").getall()
        images = [self.clean_text(img) for img in images if img.strip()] or None

        product_data = {
            "title": title,
            "sku": sku,
            "category": category,
            "breadcrumbs": breadcrumbs,
            "main_color": main_color,
            "status": status,
            "description": description,
            "colors": colors,
            "features": features,
            "pressure_rating": pressure_rating,
            "temperature_rating": temperature_rating,
            "warranty": warranty,
            "wels_rating": wels_rating,
            "flow_rate": flow_rate,
            "wels_reg_no": wels_reg_no,
            "images": images,
            "url": response.url,
        }

        self.logger.info("\n" + json.dumps(product_data, indent=4, ensure_ascii=False))
        yield product_data