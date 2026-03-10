const categoryKeywords: Record<string, string[]> = {
  Food: ["ZOMATO", "SWIGGY", "BLINKIT", "ZEPTO", "DUNZO"],
  Travel: ["IRCTC", "UBER", "OLA", "RAPIDO", "MAKEMYTRIP", "REDBUS"],
  Shopping: ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "MEESHO", "NYKAA"],
  Bills: ["BESCOM", "BWSSB", "AIRTEL", "JIO", "TATA POWER", "MSEDCL"],
  Medical: ["APOLLO", "MEDPLUS", "NETMEDS", "PHARMEASY"],
  EMIs: ["EMI", "LOAN", "NACH", "ECS", "AUTO DEBIT"],
  Investments: ["ZERODHA", "GROWW", "KUVERA", "PPF", "NSDL", "CDSL", "SIP"],
  Rent: ["RENT", "NOBROKER", "MAGICBRICKS"],
  Entertainment: ["NETFLIX", "HOTSTAR", "SPOTIFY", "YOUTUBE", "BOOKMYSHOW", "PVR"],
  Groceries: ["DMART", "BIGBASKET", "RELIANCE FRESH", "STAR BAZAAR"],
  Education: ["BYJUS", "UNACADEMY", "UDEMY", "COURSERA", "UPGRAD"]
};

export function mapCategory(description: string, customCategories?: string[]): string {
  if (!description) {
    return "Others";
  }

  const upperDesc = description.toUpperCase();

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => upperDesc.includes(keyword))) {
      return category;
    }
  }

  if (customCategories) {
    for (const customCategory of customCategories) {
      if (upperDesc.includes(customCategory.toUpperCase())) {
        return customCategory;
      }
    }
  }

  return "Others";
}
