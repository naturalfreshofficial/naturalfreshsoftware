import * as XLSX from "xlsx";

export interface SampleProductData {
  name: string;
  category: string;
  price: number;
  barcode: string;
  stock: number;
  bufferStock: number;
  status: "active" | "inactive";
  imageUrl?: string;
  isFavorite?: boolean;
}

// 300 Hand-Curated Sample Products across 7 Core Retail / Ice Cream / Supermarket Categories
export const SAMPLE_300_PRODUCTS: SampleProductData[] = [
  // ==========================================
  // CATEGORY 1: Ice Creams & Frozen Desserts (50 products)
  // ==========================================
  { name: "Amul Vanilla Gold Cup 100ml", category: "Ice Creams", price: 25.0, barcode: "8901262010011", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Royal Butterscotch Cup 100ml", category: "Ice Creams", price: 30.0, barcode: "8901262010028", stock: 50, bufferStock: 12, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Belgian Chocolate Tub 500ml", category: "Ice Creams", price: 180.0, barcode: "8901262010035", stock: 35, bufferStock: 8, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Alphonso Mango Tub 500ml", category: "Ice Creams", price: 170.0, barcode: "8901262010042", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Kesar Pista Matka Kulfi 120ml", category: "Ice Creams", price: 45.0, barcode: "8901262010059", stock: 55, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Epic Strawberry Twist Stick 80ml", category: "Ice Creams", price: 40.0, barcode: "8901262010066", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Choco Bar 60ml", category: "Ice Creams", price: 20.0, barcode: "8901262010073", stock: 90, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Tricone Chocolate 120ml", category: "Ice Creams", price: 40.0, barcode: "8901262010080", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Tricone Butterscotch 120ml", category: "Ice Creams", price: 40.0, barcode: "8901262010097", stock: 58, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Cassata Cut Slice 150ml", category: "Ice Creams", price: 60.0, barcode: "8901262010103", stock: 30, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Sugar Free Vanilla Tub 500ml", category: "Ice Creams", price: 195.0, barcode: "8901262010110", stock: 25, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Feast Chocolate 90ml", category: "Ice Creams", price: 45.0, barcode: "8901030301011", stock: 75, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kwality Wall's Cornetto Double Chocolate 110ml", category: "Ice Creams", price: 50.0, barcode: "8901030301028", stock: 80, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kwality Wall's Cornetto Butterscotch 110ml", category: "Ice Creams", price: 45.0, barcode: "8901030301035", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Magnum Classic 80ml", category: "Ice Creams", price: 90.0, barcode: "8901030301042", stock: 40, bufferStock: 10, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kwality Wall's Magnum Almond 80ml", category: "Ice Creams", price: 99.0, barcode: "8901030301059", stock: 42, bufferStock: 10, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kwality Wall's Magnum Brownie 80ml", category: "Ice Creams", price: 99.0, barcode: "8901030301066", stock: 38, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Oreo Tub 700ml", category: "Ice Creams", price: 249.0, barcode: "8901030301073", stock: 28, bufferStock: 6, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kwality Wall's Dark Chocolate Secrets 700ml", category: "Ice Creams", price: 275.0, barcode: "8901030301080", stock: 22, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Twin Choco Stick 60ml", category: "Ice Creams", price: 25.0, barcode: "8901030301097", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Mango Zap Ice Pop 60ml", category: "Ice Creams", price: 15.0, barcode: "8901030301103", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Kwality Wall's Orange Mahacool 60ml", category: "Ice Creams", price: 15.0, barcode: "8901030301110", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal Gourmet Belgian Truffle Tub 1L", category: "Ice Creams", price: 340.0, barcode: "8901305010015", stock: 18, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal Badam Carnation Cup 100ml", category: "Ice Creams", price: 35.0, barcode: "8901305010022", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal Rajbhog Cup 125ml", category: "Ice Creams", price: 40.0, barcode: "8901305010039", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal Funtasty Kulfi Stick 70ml", category: "Ice Creams", price: 30.0, barcode: "8901305010046", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal Black Forest Cake Tub 750ml", category: "Ice Creams", price: 260.0, barcode: "8901305010053", stock: 20, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Vadilal American Nuts Tub 1L", category: "Ice Creams", price: 320.0, barcode: "8901305010060", stock: 22, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Havmor Wild Berries Ice Cream Tub 700ml", category: "Ice Creams", price: 220.0, barcode: "8901452010014", stock: 24, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Havmor Cookie & Cream Cone 120ml", category: "Ice Creams", price: 45.0, barcode: "8901452010021", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Havmor Zulubar Ice Cream Stick 70ml", category: "Ice Creams", price: 35.0, barcode: "8901452010038", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Havmor Chocolate Overload Sundae 140ml", category: "Ice Creams", price: 55.0, barcode: "8901452010045", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Havmor Kesar Pista Family Pack 1L", category: "Ice Creams", price: 290.0, barcode: "8901452010052", stock: 20, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Cream Stone Willy Wonka Tub 500ml", category: "Ice Creams", price: 299.0, barcode: "8901999010019", stock: 15, bufferStock: 4, status: "active", imageUrl: "/logo.png" },
  { name: "Cream Stone Ferrero Delight Tub 500ml", category: "Ice Creams", price: 320.0, barcode: "8901999010026", stock: 14, bufferStock: 4, status: "active", imageUrl: "/logo.png" },
  { name: "Cream Stone Nutty Overload Tub 500ml", category: "Ice Creams", price: 280.0, barcode: "8901999010033", stock: 18, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Arun Icecream Cassata Slice 120ml", category: "Ice Creams", price: 45.0, barcode: "8901608010018", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Arun Icecream Strawberry Ball 80ml", category: "Ice Creams", price: 20.0, barcode: "8901608010025", stock: 70, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Arun Icecream Chocolate Spiral Cone 110ml", category: "Ice Creams", price: 40.0, barcode: "8901608010032", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Arun Icecream Kulfi Maharaja Stick 90ml", category: "Ice Creams", price: 35.0, barcode: "8901608010049", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Arun Icecream Cotton Candy Tub 500ml", category: "Ice Creams", price: 160.0, barcode: "8901608010056", stock: 25, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Dinshaws Vanilla Family Tub 1.25L", category: "Ice Creams", price: 199.0, barcode: "8901724010012", stock: 20, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Dinshaws Tender Coconut Tub 750ml", category: "Ice Creams", price: 230.0, barcode: "8901724010029", stock: 22, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Dinshaws Choco Nut Cone 120ml", category: "Ice Creams", price: 45.0, barcode: "8901724010036", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Baskin Robbins Mississippi Mud Tub 450ml", category: "Ice Creams", price: 380.0, barcode: "8901844010017", stock: 16, bufferStock: 4, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Baskin Robbins Cotton Candy Scoop 150ml", category: "Ice Creams", price: 140.0, barcode: "8901844010024", stock: 20, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Baskin Robbins Mint Milk Choco Chip 450ml", category: "Ice Creams", price: 380.0, barcode: "8901844010031", stock: 15, bufferStock: 4, status: "active", imageUrl: "/logo.png" },
  { name: "Baskin Robbins Alphonso Mango Stick 70ml", category: "Ice Creams", price: 80.0, barcode: "8901844010048", stock: 30, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "London Dairy Double Chocolate Tub 500ml", category: "Ice Creams", price: 420.0, barcode: "8901965010011", stock: 12, bufferStock: 3, status: "active", imageUrl: "/logo.png" },
  { name: "London Dairy Pralines & Cream 500ml", category: "Ice Creams", price: 420.0, barcode: "8901965010028", stock: 14, bufferStock: 3, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 2: Dairy & Fresh (45 products)
  // ==========================================
  { name: "Amul Taaza Homogenised Toned Milk 1L", category: "Dairy", price: 74.0, barcode: "8901262020010", stock: 85, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Gold Full Cream Milk 1L", category: "Dairy", price: 82.0, barcode: "8901262020027", stock: 90, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Salted Butter 500g", category: "Dairy", price: 275.0, barcode: "8901262020034", stock: 45, bufferStock: 10, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Salted Butter 100g", category: "Dairy", price: 58.0, barcode: "8901262020041", stock: 110, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Unsalted Butter 500g", category: "Dairy", price: 285.0, barcode: "8901262020058", stock: 25, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Pure Cow Ghee 1L Tin", category: "Dairy", price: 650.0, barcode: "8901262020065", stock: 35, bufferStock: 10, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Pure Cow Ghee 500ml Pouch", category: "Dairy", price: 335.0, barcode: "8901262020072", stock: 40, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Fresh Paneer 200g", category: "Dairy", price: 92.0, barcode: "8901262020089", stock: 55, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Amul Fresh Paneer 1kg Block", category: "Dairy", price: 420.0, barcode: "8901262020096", stock: 20, bufferStock: 5, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Processed Cheese Slices 200g (10 Slices)", category: "Dairy", price: 145.0, barcode: "8901262020102", stock: 48, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Cheese Block 500g", category: "Dairy", price: 290.0, barcode: "8901262020119", stock: 30, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Mozzarella Pizza Cheese Diced 200g", category: "Dairy", price: 130.0, barcode: "8901262020126", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Fresh Cream 250ml", category: "Dairy", price: 70.0, barcode: "8901262020133", stock: 50, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Mithai Mate Condensed Milk 400g", category: "Dairy", price: 140.0, barcode: "8901262020140", stock: 35, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Masti Spiced Buttermilk 200ml", category: "Dairy", price: 15.0, barcode: "8901262020157", stock: 120, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Kool Kesar Flavour 180ml Can", category: "Dairy", price: 35.0, barcode: "8901262020164", stock: 65, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Kool Badam Flavour 180ml Can", category: "Dairy", price: 35.0, barcode: "8901262020171", stock: 60, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Amul Kool Elaichi 180ml Can", category: "Dairy", price: 35.0, barcode: "8901262020188", stock: 50, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Toned Milk 500ml Pouch", category: "Dairy", price: 29.0, barcode: "8901582020018", stock: 110, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Standardized Milk 500ml Pouch", category: "Dairy", price: 32.0, barcode: "8901582020025", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Pure Cow Ghee 500ml", category: "Dairy", price: 345.0, barcode: "8901582020032", stock: 32, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Fresh Curd 500g Tub", category: "Dairy", price: 42.0, barcode: "8901582020049", stock: 70, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Fresh Curd 1kg Pouch", category: "Dairy", price: 78.0, barcode: "8901582020056", stock: 60, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Fresh Paneer 200g", category: "Dairy", price: 95.0, barcode: "8901582020063", stock: 45, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Badam Drink 200ml Bottle", category: "Dairy", price: 30.0, barcode: "8901582020070", stock: 75, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Heritage Mango Lassi 200ml", category: "Dairy", price: 25.0, barcode: "8901582020087", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Nandini GoodLife Toned Milk 1L Tetra", category: "Dairy", price: 68.0, barcode: "8901416020015", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Nandini Pure Cow Ghee 1L Pouch", category: "Dairy", price: 610.0, barcode: "8901416020022", stock: 38, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Nandini Unsalted Butter 200g", category: "Dairy", price: 115.0, barcode: "8901416020039", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Nandini Soft Paneer 200g", category: "Dairy", price: 88.0, barcode: "8901416020046", stock: 50, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Mother Dairy Toned Milk 1L Poly", category: "Dairy", price: 56.0, barcode: "8901648020019", stock: 80, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Mother Dairy Classic Curd 400g Cup", category: "Dairy", price: 35.0, barcode: "8901648020026", stock: 65, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Mother Dairy Pure Ghee 1L Pouch", category: "Dairy", price: 620.0, barcode: "8901648020033", stock: 28, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Mother Dairy Cheese Slices 200g", category: "Dairy", price: 140.0, barcode: "8901648020040", stock: 42, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Cheese Slices 200g (10 Slices)", category: "Dairy", price: 150.0, barcode: "8901063020017", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Cheese Block 200g", category: "Dairy", price: 135.0, barcode: "8901063020024", stock: 48, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Cheese Cubes 200g (8 Cubes)", category: "Dairy", price: 142.0, barcode: "8901063020031", stock: 52, bufferStock: 14, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Pure Cow Ghee 500ml", category: "Dairy", price: 340.0, barcode: "8901063020048", stock: 30, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Nestle Everyday Dairy Whitener 1kg", category: "Dairy", price: 460.0, barcode: "8901058020011", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Nestle Everyday Dairy Whitener 400g", category: "Dairy", price: 210.0, barcode: "8901058020028", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Nestle Milkmaid Sweetened Condensed Milk 380g", category: "Dairy", price: 145.0, barcode: "8901058020035", stock: 58, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Nestle A+ Toned Milk 1L Tetra", category: "Dairy", price: 95.0, barcode: "8901058020042", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Milky Mist Cooking Butter 500g", category: "Dairy", price: 260.0, barcode: "8901765020013", stock: 35, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Milky Mist Paneer Premium 500g", category: "Dairy", price: 230.0, barcode: "8901765020020", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Milky Mist Greek Yogurt Natural 100g", category: "Dairy", price: 40.0, barcode: "8901765020037", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 3: Groceries & Staples (60 products)
  // ==========================================
  { name: "Aashirvaad Superior MP Shudh Chakki Atta 5kg", category: "Groceries", price: 260.0, barcode: "8901207000730", stock: 75, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Aashirvaad Superior MP Shudh Chakki Atta 10kg", category: "Groceries", price: 495.0, barcode: "8901207000747", stock: 45, bufferStock: 10, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Aashirvaad Select Sharbati Atta 5kg", category: "Groceries", price: 320.0, barcode: "8901207000754", stock: 35, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Sunlite Refined Sunflower Oil 1L Pouch", category: "Groceries", price: 132.0, barcode: "8901030820217", stock: 120, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Fortune Sunlite Refined Sunflower Oil 5L Jar", category: "Groceries", price: 680.0, barcode: "8901030820224", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Kachi Ghani Mustard Oil 1L", category: "Groceries", price: 155.0, barcode: "8901030820231", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Rice Bran Health Oil 1L", category: "Groceries", price: 140.0, barcode: "8901030820248", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Groundnut Oil 1L Pouch", category: "Groceries", price: 185.0, barcode: "8901030820255", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Salt Vacuum Evaporated Iodised 1kg", category: "Groceries", price: 28.0, barcode: "8901056308512", stock: 200, bufferStock: 50, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Tata Salt Lite Low Sodium 1kg", category: "Groceries", price: 45.0, barcode: "8901056308529", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Sampann Unpolished Toor Dal 1kg", category: "Groceries", price: 165.0, barcode: "8901056308536", stock: 80, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Tata Sampann Unpolished Moong Dal 1kg", category: "Groceries", price: 145.0, barcode: "8901056308543", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Sampann Unpolished Chana Dal 1kg", category: "Groceries", price: 110.0, barcode: "8901056308550", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Sampann Unpolished Urad Dal 1kg", category: "Groceries", price: 155.0, barcode: "8901056308567", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Sampann Kabuli Chana 1kg", category: "Groceries", price: 175.0, barcode: "8901056308574", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Sampann Rajma Red 1kg", category: "Groceries", price: 160.0, barcode: "8901056308581", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Daawat Rozana Gold Basmati Rice 5kg", category: "Groceries", price: 420.0, barcode: "8901537030018", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Daawat Biryani Basmati Rice 1kg", category: "Groceries", price: 210.0, barcode: "8901537030025", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "India Gate Basmati Rice Feast Rozzana 5kg", category: "Groceries", price: 450.0, barcode: "8901412030016", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "India Gate Basmati Rice Classic 1kg", category: "Groceries", price: 235.0, barcode: "8901412030023", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Sona Masoori Raw Rice Premium 25kg Bag", category: "Groceries", price: 1450.0, barcode: "8901999030017", stock: 30, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Sona Masoori Raw Rice Premium 10kg Bag", category: "Groceries", price: 620.0, barcode: "8901999030024", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Sona Masoori Boiled Rice 25kg Bag", category: "Groceries", price: 1350.0, barcode: "8901999030031", stock: 25, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Madhur Pure & Hygienic Refined Sugar 1kg", category: "Groceries", price: 48.0, barcode: "8901856030012", stock: 150, bufferStock: 40, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Madhur Pure & Hygienic Refined Sugar 5kg", category: "Groceries", price: 235.0, barcode: "8901856030029", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Organic Tattva Jaggery Powder 500g", category: "Groceries", price: 75.0, barcode: "8901768030019", stock: 45, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Patanjali Shudh Ghee 1L Pouch", category: "Groceries", price: 630.0, barcode: "8901639030018", stock: 35, bufferStock: 8, status: "active", imageUrl: "/logo.png" },
  { name: "Patanjali Honey 500g", category: "Groceries", price: 180.0, barcode: "8901639030025", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Dabur 100% Pure Honey 500g Squeezy", category: "Groceries", price: 215.0, barcode: "8901207030014", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Dabur 100% Pure Honey 1kg Jar", category: "Groceries", price: 395.0, barcode: "8901207030021", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Saffola Gold Pro Healthy Heart Oil 1L Pouch", category: "Groceries", price: 165.0, barcode: "8901088030015", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Saffola Total Pro Heart Oil 5L Jar", category: "Groceries", price: 920.0, barcode: "8901088030022", stock: 25, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Saffola Masala Oats Classic Masala 500g", category: "Groceries", price: 175.0, barcode: "8901088030039", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Quaker Rolled Oats 1kg Pouch", category: "Groceries", price: 190.0, barcode: "8901491030011", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Kellogg's Corn Flakes Original 875g", category: "Groceries", price: 320.0, barcode: "8901499030018", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Kellogg's Chocos 375g Box", category: "Groceries", price: 175.0, barcode: "8901499030025", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Everest Turmeric Powder Haldi 200g", category: "Groceries", price: 42.0, barcode: "8901786030016", stock: 90, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Everest Tikhalal Red Chilli Powder 200g", category: "Groceries", price: 78.0, barcode: "8901786030023", stock: 85, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Everest Coriander Powder Dhaniya 200g", category: "Groceries", price: 48.0, barcode: "8901786030030", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Everest Garam Masala Powder 100g", category: "Groceries", price: 72.0, barcode: "8901786030047", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Everest Chicken Masala 100g", category: "Groceries", price: 68.0, barcode: "8901786030054", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Everest Pav Bhaji Masala 100g", category: "Groceries", price: 65.0, barcode: "8901786030061", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Catch Cumin Seeds Jeera Whole 200g", category: "Groceries", price: 110.0, barcode: "8901192030018", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Catch Black Pepper Kali Mirch Whole 100g", category: "Groceries", price: 95.0, barcode: "8901192030025", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Catch Mustard Seeds Rai Whole 200g", category: "Groceries", price: 40.0, barcode: "8901192030032", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "MDH Deggi Mirch Powder 100g", category: "Groceries", price: 74.0, barcode: "8901248030015", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "MDH Kitchen King Masala 100g", category: "Groceries", price: 76.0, barcode: "8901248030022", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "MDH Chana Masala 100g", category: "Groceries", price: 68.0, barcode: "8901248030039", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Nutrela Soya Chunks 200g Box", category: "Groceries", price: 48.0, barcode: "8901712030012", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Nutrela Mini Soya Chunks 200g", category: "Groceries", price: 50.0, barcode: "8901712030029", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "MTR Upma Mix 500g", category: "Groceries", price: 95.0, barcode: "8901042030017", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "MTR Rava Idli Mix 500g", category: "Groceries", price: 110.0, barcode: "8901042030024", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "MTR Gulab Jamun Instant Mix 200g (1+1 Offer)", category: "Groceries", price: 135.0, barcode: "8901042030031", stock: 60, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "MTR Sambar Powder 200g", category: "Groceries", price: 82.0, barcode: "8901042030048", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Priya Mango Pickle with Garlic 300g Jar", category: "Groceries", price: 95.0, barcode: "8901594030013", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Priya Lime Pickle 300g Jar", category: "Groceries", price: 90.0, barcode: "8901594030020", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Priya Gongura Pickle 300g Jar", category: "Groceries", price: 105.0, barcode: "8901594030037", stock: 65, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Fortune Maida All Purpose Flour 1kg", category: "Groceries", price: 44.0, barcode: "8901030820262", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Besan Gram Flour 500g", category: "Groceries", price: 58.0, barcode: "8901030820279", stock: 90, bufferStock: 22, status: "active", imageUrl: "/logo.png" },
  { name: "Fortune Sooji Fine Rava 1kg", category: "Groceries", price: 48.0, barcode: "8901030820286", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 4: Beverages & Soft Drinks (45 products)
  // ==========================================
  { name: "Brooke Bond Red Label Tea 500g Carton", category: "Beverages", price: 260.0, barcode: "8901030811210", stock: 80, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Brooke Bond Red Label Natural Care 250g", category: "Beverages", price: 160.0, barcode: "8901030811227", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Brooke Bond Taj Mahal Tea 500g", category: "Beverages", price: 360.0, barcode: "8901030811234", stock: 45, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Tea Gold 500g Carton", category: "Beverages", price: 310.0, barcode: "8901056040016", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Tata Tea Premium 1kg Poly Pack", category: "Beverages", price: 460.0, barcode: "8901056040023", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Tata Tea Agni 250g Pouch", category: "Beverages", price: 65.0, barcode: "8901056040030", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Wagh Bakri Premium Leaf Tea 500g", category: "Beverages", price: 270.0, barcode: "8901869040017", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Nescafe Classic 100% Pure Coffee 50g Glass Jar", category: "Beverages", price: 165.0, barcode: "8901058863214", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Nescafe Classic 100% Pure Coffee 100g Jar", category: "Beverages", price: 315.0, barcode: "8901058863221", stock: 48, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Nescafe Sunrise Chicory Blend Coffee 100g", category: "Beverages", price: 140.0, barcode: "8901058863238", stock: 75, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "BRU Instant Coffee 100g Jar", category: "Beverages", price: 185.0, barcode: "8901030040011", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "BRU Gold 100% Pure Filter Coffee 100g", category: "Beverages", price: 290.0, barcode: "8901030040028", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Thums Up Soft Drink 750ml PET Bottle", category: "Beverages", price: 40.0, barcode: "8901764040012", stock: 120, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Thums Up Soft Drink 2.25L Bottle", category: "Beverages", price: 95.0, barcode: "8901764040029", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Thums Up Soft Drink 300ml Can", category: "Beverages", price: 35.0, barcode: "8901764040036", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Coca-Cola Original Taste 750ml Bottle", category: "Beverages", price: 40.0, barcode: "8901764040043", stock: 110, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Coca-Cola Original Taste 2.25L Bottle", category: "Beverages", price: 95.0, barcode: "8901764040050", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Coca-Cola Diet Coke 300ml Can", category: "Beverages", price: 40.0, barcode: "8901764040067", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Sprite Refreshing Lemon Drink 750ml", category: "Beverages", price: 40.0, barcode: "8901764040074", stock: 115, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Sprite Refreshing Lemon Drink 2.25L", category: "Beverages", price: 95.0, barcode: "8901764040081", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Pepsi Cola Refreshing 750ml PET", category: "Beverages", price: 40.0, barcode: "8901491040010", stock: 90, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Mirinda Orange Flavoured Drink 750ml", category: "Beverages", price: 40.0, barcode: "8901491040027", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Mountain Dew Neon Citrus 750ml", category: "Beverages", price: 40.0, barcode: "8901491040034", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "7UP Refreshing Clear Lemon 750ml", category: "Beverages", price: 40.0, barcode: "8901491040041", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Maaza Mango Drink 1.2L Bottle", category: "Beverages", price: 65.0, barcode: "8901764040098", stock: 100, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Maaza Mango Drink 600ml Bottle", category: "Beverages", price: 38.0, barcode: "8901764040104", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Frooti Fresh 'N' Juicy Mango 1L Tetra", category: "Beverages", price: 60.0, barcode: "8901715040018", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Frooti Mango Drink 160ml Tetra", category: "Beverages", price: 10.0, barcode: "8901715040025", stock: 150, bufferStock: 40, status: "active", imageUrl: "/logo.png" },
  { name: "Real Fruit Power Mixed Fruit Juice 1L Tetra", category: "Beverages", price: 125.0, barcode: "8901207040013", stock: 60, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Real Fruit Power Mango Juice 1L Tetra", category: "Beverages", price: 125.0, barcode: "8901207040020", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Real Fruit Power Guava Juice 1L Tetra", category: "Beverages", price: 125.0, barcode: "8901207040037", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Tropicana 100% Orange Juice 1L", category: "Beverages", price: 140.0, barcode: "8901491040058", stock: 45, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Tropicana Apple Delight 1L Tetra", category: "Beverages", price: 120.0, barcode: "8901491040065", stock: 48, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Red Bull Energy Drink 250ml Can", category: "Beverages", price: 125.0, barcode: "9002490100070", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Red Bull Sugar Free 250ml Can", category: "Beverages", price: 125.0, barcode: "9002490100087", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Monster Energy Original 350ml Can", category: "Beverages", price: 125.0, barcode: "7084700010012", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Horlicks Health & Nutrition Drink Classic Malt 500g Jar", category: "Beverages", price: 265.0, barcode: "8901030040035", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Horlicks Chocolate Flavour 500g Refill", category: "Beverages", price: 245.0, barcode: "8901030040042", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Boost Energy Drink 500g Jar", category: "Beverages", price: 255.0, barcode: "8901030040059", stock: 58, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Cadbury Bournvita Chocolate Health Drink 500g Jar", category: "Beverages", price: 240.0, barcode: "8901233040012", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kinley Packaged Drinking Water 1L Bottle", category: "Beverages", price: 20.0, barcode: "8901764040111", stock: 200, bufferStock: 50, status: "active", imageUrl: "/logo.png" },
  { name: "Bisleri Mineral Water 1L Bottle", category: "Beverages", price: 20.0, barcode: "8906001040019", stock: 220, bufferStock: 50, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Bisleri Mineral Water 500ml Bottle", category: "Beverages", price: 10.0, barcode: "8906001040026", stock: 180, bufferStock: 40, status: "active", imageUrl: "/logo.png" },
  { name: "Schweppes Tonic Water 300ml Can", category: "Beverages", price: 60.0, barcode: "8901764040128", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Schweppes Club Soda 750ml PET", category: "Beverages", price: 20.0, barcode: "8901764040135", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 5: Snacks & Confectionery (50 products)
  // ==========================================
  { name: "Parle-G Glucose Biscuit 250g Mega Pack", category: "Snacks", price: 25.0, barcode: "8901715000050", stock: 150, bufferStock: 40, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Parle Hide & Seek Chocolate Chip Cookies 120g", category: "Snacks", price: 35.0, barcode: "8901715050017", stock: 90, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Parle Monaco Salted Biscuit 200g", category: "Snacks", price: 30.0, barcode: "8901715050024", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Parle Krackjack Sweet & Salty Cracker 200g", category: "Snacks", price: 30.0, barcode: "8901715050031", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Good Day Cashew Cookies 200g", category: "Snacks", price: 40.0, barcode: "8901063050014", stock: 110, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Britannia Good Day Butter Cookies 200g", category: "Snacks", price: 35.0, barcode: "8901063050021", stock: 105, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Marie Gold Biscuit 300g Super Saver", category: "Snacks", price: 40.0, barcode: "8901063050038", stock: 120, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Bourbon Chocolate Cream Biscuits 150g", category: "Snacks", price: 35.0, barcode: "8901063050045", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia Little Hearts Sugar Biscuits 75g", category: "Snacks", price: 20.0, barcode: "8901063050052", stock: 100, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia NutriChoice Digestive Hi-Fibre 250g", category: "Snacks", price: 60.0, barcode: "8901063050069", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Britannia 50-50 Maska Chaska 120g", category: "Snacks", price: 25.0, barcode: "8901063050076", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Oreo Vanilla Cream Sandwich Cookies 120g", category: "Snacks", price: 35.0, barcode: "8901233050011", stock: 115, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Oreo Chocolate Cream Sandwich Cookies 120g", category: "Snacks", price: 35.0, barcode: "8901233050028", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Sunfeast Dark Fantasy Choco Fills 300g Feast Pack", category: "Snacks", price: 140.0, barcode: "8901207050012", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Sunfeast Dark Fantasy Choco Fills 75g", category: "Snacks", price: 40.0, barcode: "8901207050029", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Sunfeast Mom's Magic Cashew & Almond 200g", category: "Snacks", price: 40.0, barcode: "8901207050036", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Lay's Classic Salted Potato Chips 50g", category: "Snacks", price: 20.0, barcode: "8901491102541", stock: 130, bufferStock: 35, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Lay's India's Magic Masala Chips 50g", category: "Snacks", price: 20.0, barcode: "8901491050019", stock: 140, bufferStock: 35, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Lay's American Style Cream & Onion 50g", category: "Snacks", price: 20.0, barcode: "8901491050026", stock: 125, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Lay's Spanish Tomato Tango Chips 50g", category: "Snacks", price: 20.0, barcode: "8901491050033", stock: 110, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Lay's Wafer Style Salt with Black Pepper 50g", category: "Snacks", price: 20.0, barcode: "8901491050040", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Kurkure Masala Munch Crisps 85g", category: "Snacks", price: 20.0, barcode: "8901491050057", stock: 145, bufferStock: 40, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Kurkure Chilli Chatka 85g", category: "Snacks", price: 20.0, barcode: "8901491050064", stock: 100, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Kurkure Green Chutney Style 85g", category: "Snacks", price: 20.0, barcode: "8901491050071", stock: 95, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Doritos Cheese Supreme Nacho Chips 60g", category: "Snacks", price: 30.0, barcode: "8901491050088", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Doritos Sweet Chilli Nacho Chips 60g", category: "Snacks", price: 30.0, barcode: "8901491050095", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Pringles Original Potato Crisps 107g Can", category: "Snacks", price: 115.0, barcode: "8886467100018", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Pringles Sour Cream & Onion 107g Can", category: "Snacks", price: 115.0, barcode: "8886467100025", stock: 60, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Haldiram's Nagpur Bhujia Sev 400g Pouch", category: "Snacks", price: 110.0, barcode: "8904004400017", stock: 85, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Haldiram's Aloo Bhujia 400g Pouch", category: "Snacks", price: 115.0, barcode: "8904004400024", stock: 90, bufferStock: 22, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Haldiram's All in One Mixture 400g", category: "Snacks", price: 120.0, barcode: "8904004400031", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Haldiram's Khatta Meetha Mixture 400g", category: "Snacks", price: 110.0, barcode: "8904004400048", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Haldiram's Moong Dal Fried Namkeen 200g", category: "Snacks", price: 65.0, barcode: "8904004400055", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Haldiram's Salted Peanuts 200g", category: "Snacks", price: 55.0, barcode: "8904004400062", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Bikaji Bhujia No. 1 Bikaneri 400g", category: "Snacks", price: 110.0, barcode: "8906020050019", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Cadbury Dairy Milk Silk Chocolate 60g", category: "Snacks", price: 80.0, barcode: "8901233050035", stock: 120, bufferStock: 30, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Cadbury Dairy Milk Silk Roast Almond 58g", category: "Snacks", price: 90.0, barcode: "8901233050042", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Cadbury Dairy Milk Chocolate 50g Bar", category: "Snacks", price: 45.0, barcode: "8901233050059", stock: 140, bufferStock: 35, status: "active", imageUrl: "/logo.png" },
  { name: "Cadbury 5 Star Chocolate Bar 40g", category: "Snacks", price: 20.0, barcode: "8901233050066", stock: 150, bufferStock: 40, status: "active", imageUrl: "/logo.png" },
  { name: "Cadbury Fuse Chocolate Peanut Bar 45g", category: "Snacks", price: 35.0, barcode: "8901233050073", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Nestle KitKat 4 Finger Chocolate Bar 38g", category: "Snacks", price: 30.0, barcode: "8901058050018", stock: 135, bufferStock: 35, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Nestle Munch Crunchy Wafer Bar 22g", category: "Snacks", price: 10.0, barcode: "8901058050025", stock: 180, bufferStock: 50, status: "active", imageUrl: "/logo.png" },
  { name: "Nestle Milkybar White Chocolate 25g", category: "Snacks", price: 20.0, barcode: "8901058050032", stock: 110, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Snickers Peanut Chocolate Bar 45g", category: "Snacks", price: 40.0, barcode: "8901452050010", stock: 95, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Ferrero Rocher Hazelnut Chocolates Pack of 3", category: "Snacks", price: 135.0, barcode: "8000500003787", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Ferrero Rocher Box 16 Pieces 200g", category: "Snacks", price: 649.0, barcode: "8000500003794", stock: 25, bufferStock: 6, status: "active", imageUrl: "/logo.png" },
  { name: "Maggi 2-Minute Instant Noodles Masala 70g", category: "Snacks", price: 14.0, barcode: "8901058050049", stock: 250, bufferStock: 60, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Maggi 2-Minute Instant Noodles Special Masala 70g", category: "Snacks", price: 18.0, barcode: "8901058050056", stock: 150, bufferStock: 35, status: "active", imageUrl: "/logo.png" },
  { name: "Yippee! Magic Masala Noodles 240g (Pack of 4)", category: "Snacks", price: 58.0, barcode: "8901207050043", stock: 110, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Ching's Secret Hakka Noodles 150g", category: "Snacks", price: 40.0, barcode: "8901594050011", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 6: Personal Care (30 products)
  // ==========================================
  { name: "Colgate Strong Teeth Toothpaste 200g Saver", category: "Personal Care", price: 115.0, barcode: "8901314562019", stock: 95, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Colgate MaxFresh Peppermint Ice Gel 150g", category: "Personal Care", price: 125.0, barcode: "8901314562026", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Colgate Total 12 Active Fresh 120g", category: "Personal Care", price: 160.0, barcode: "8901314562033", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Close-Up Deep Action Red Hot Gel 150g", category: "Personal Care", price: 110.0, barcode: "8901030060019", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Sensodyne Fresh Mint Sensitive Toothpaste 75g", category: "Personal Care", price: 175.0, barcode: "8901571060018", stock: 55, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Oral-B Classic Toothbrush Medium Pack of 3", category: "Personal Care", price: 75.0, barcode: "8901233060019", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Dettol Original Germ Protection Soap 125g (Buy 4 Get 1)", category: "Personal Care", price: 215.0, barcode: "8901396060014", stock: 75, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Dettol Original Germ Protection Soap 75g", category: "Personal Care", price: 38.0, barcode: "8901396060021", stock: 120, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Dettol Skincare Soap 125g", category: "Personal Care", price: 58.0, barcode: "8901396060038", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Dove Cream Beauty Bathing Bar 100g (Buy 3 Get 1)", category: "Personal Care", price: 245.0, barcode: "8901030612981", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Dove Cream Beauty Bathing Bar 75g", category: "Personal Care", price: 55.0, barcode: "8901030612998", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Lifebuoy Total 10 Germ Protection Soap 125g", category: "Personal Care", price: 42.0, barcode: "8901030060026", stock: 110, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Lux Soft Glow Rose Beauty Bar 100g", category: "Personal Care", price: 45.0, barcode: "8901030060033", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Pears Pure & Gentle Glycerine Soap 125g", category: "Personal Care", price: 78.0, barcode: "8901030060040", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Cinthol Original Deodorant & Complexion Soap 100g", category: "Personal Care", price: 48.0, barcode: "8901023060012", stock: 80, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Clinic Plus Strong & Long Health Shampoo 340ml", category: "Personal Care", price: 195.0, barcode: "8901030721458", stock: 70, bufferStock: 18, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Clinic Plus Strong & Long Shampoo 175ml", category: "Personal Care", price: 110.0, barcode: "8901030721465", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Head & Shoulders Anti-Dandruff Smooth & Silky 340ml", category: "Personal Care", price: 299.0, barcode: "8901233060026", stock: 55, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Head & Shoulders Cool Menthol Shampoo 180ml", category: "Personal Care", price: 175.0, barcode: "8901233060033", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Sunsilk Black Shine Shampoo 350ml Bottle", category: "Personal Care", price: 235.0, barcode: "8901030060057", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Dove Intense Repair Shampoo 340ml", category: "Personal Care", price: 280.0, barcode: "8901030060064", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Nivea Soft Light Moisturiser Cream 100ml", category: "Personal Care", price: 190.0, barcode: "8901526060016", stock: 65, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Nivea Body Milk Nourishing Lotion 200ml", category: "Personal Care", price: 240.0, barcode: "8901526060023", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Vaseline Intensive Care Deep Moisture 200ml", category: "Personal Care", price: 210.0, barcode: "8901030060071", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Pond's Bright Beauty Face Wash 100g", category: "Personal Care", price: 165.0, barcode: "8901030060088", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Garnier Men Acno Fight Face Wash 100g", category: "Personal Care", price: 180.0, barcode: "8901526060030", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Gillette Mach 3 Razor with 1 Cartridge", category: "Personal Care", price: 299.0, barcode: "8901233060040", stock: 40, bufferStock: 10, status: "active", imageUrl: "/logo.png" },
  { name: "Gillette Classic Regular Shaving Foam 200ml", category: "Personal Care", price: 165.0, barcode: "8901233060057", stock: 50, bufferStock: 12, status: "active", imageUrl: "/logo.png" },
  { name: "Whisper Ultra Clean Wings Sanitary Pads (XL 15s)", category: "Personal Care", price: 175.0, barcode: "8901233060064", stock: 80, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Stayfree Secure Cottony Sanitary Napkins (XL 18s)", category: "Personal Care", price: 145.0, barcode: "8901088060012", stock: 75, bufferStock: 18, status: "active", imageUrl: "/logo.png" },

  // ==========================================
  // CATEGORY 7: Household & Cleaning (20 products)
  // ==========================================
  { name: "Surf Excel Matic Front Load Detergent 1kg", category: "Household", price: 245.0, barcode: "8901030900721", stock: 60, bufferStock: 15, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Surf Excel Matic Top Load Detergent 1kg", category: "Household", price: 225.0, barcode: "8901030900738", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Surf Excel Easy Wash Detergent Powder 1kg", category: "Household", price: 145.0, barcode: "8901030900745", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "Ariel Complete Detergent Washing Powder 1kg", category: "Household", price: 215.0, barcode: "8901233070018", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Tide Plus Extra Power Detergent Jasmine & Rose 1kg", category: "Household", price: 130.0, barcode: "8901030219842", stock: 100, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Rin Advanced Detergent Bar 250g (Pack of 4)", category: "Household", price: 78.0, barcode: "8901030070018", stock: 110, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Vim Dishwash Gel Lemon 500ml Bottle", category: "Household", price: 125.0, barcode: "8901030070025", stock: 95, bufferStock: 25, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Vim Dishwash Bar 300g", category: "Household", price: 28.0, barcode: "8901030070032", stock: 140, bufferStock: 35, status: "active", imageUrl: "/logo.png" },
  { name: "Pril Dishwash Liquid Lime 425ml", category: "Household", price: 115.0, barcode: "8901305070019", stock: 65, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Harpic Power Plus Toilet Cleaner 1L Original", category: "Household", price: 195.0, barcode: "8901396070013", stock: 85, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Harpic Bathroom Cleaner Lemon 500ml", category: "Household", price: 105.0, barcode: "8901396070020", stock: 70, bufferStock: 18, status: "active", imageUrl: "/logo.png" },
  { name: "Lizol Disinfectant Floor Cleaner Citrus 1L", category: "Household", price: 215.0, barcode: "8901396070037", stock: 80, bufferStock: 20, status: "active", isFavorite: true, imageUrl: "/logo.png" },
  { name: "Lizol Disinfectant Surface Cleaner Floral 500ml", category: "Household", price: 115.0, barcode: "8901396070044", stock: 90, bufferStock: 22, status: "active", imageUrl: "/logo.png" },
  { name: "Colin Glass and Multi-Surface Cleaner 500ml", category: "Household", price: 99.0, barcode: "8901396070051", stock: 85, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "Comfort After Wash Morning Fresh Fabric Conditioner 860ml", category: "Household", price: 235.0, barcode: "8901030070049", stock: 55, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Good Knight Gold Flash Liquid Mosquito Refill (45ml x 2)", category: "Household", price: 160.0, barcode: "8901023070011", stock: 90, bufferStock: 20, status: "active", imageUrl: "/logo.png" },
  { name: "All Out Ultra Power+ Mosquito Refill 45ml", category: "Household", price: 85.0, barcode: "8901396070068", stock: 95, bufferStock: 25, status: "active", imageUrl: "/logo.png" },
  { name: "HIT Flying Insect Killer Black Hit Spray 400ml", category: "Household", price: 220.0, barcode: "8901023070028", stock: 60, bufferStock: 15, status: "active", imageUrl: "/logo.png" },
  { name: "Odonil Room Air Freshener Jasmine Block 50g", category: "Household", price: 42.0, barcode: "8901207070010", stock: 120, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
  { name: "Scotch-Brite Scrub Sponge Classic (Pack of 3)", category: "Household", price: 99.0, barcode: "8901362070014", stock: 110, bufferStock: 30, status: "active", imageUrl: "/logo.png" },
];

// Helper to convert array of products to Excel Worksheet & trigger browser download
export function downloadSampleExcel(productsList = SAMPLE_300_PRODUCTS, fileName = "sample_products_catalog_300.xlsx") {
  const excelData = productsList.map((p, idx) => ({
    "SL No": idx + 1,
    "Product Name": p.name,
    "Category": p.category,
    "Price (INR)": p.price,
    "Barcode ID": p.barcode,
    "Buffer Stock": p.bufferStock,
    "Status": p.status,
    "Is Favorite": p.isFavorite ? "Yes" : "No",
    "Image URL": p.imageUrl || "/logo.png",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for beautiful layout
  worksheet["!cols"] = [
    { wch: 8 },  // SL No
    { wch: 45 }, // Product Name
    { wch: 22 }, // Category
    { wch: 14 }, // Price (INR)
    { wch: 18 }, // Barcode ID
    { wch: 14 }, // Buffer Stock
    { wch: 12 }, // Status
    { wch: 12 }, // Is Favorite
    { wch: 25 }, // Image URL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products Catalog");

  XLSX.writeFile(workbook, fileName);
}

// Download Blank Template for user filling
export function downloadBlankTemplate(fileName = "products_import_template.xlsx") {
  const sampleTemplate = [
    {
      "Product Name": "Amul Vanilla Cup 100ml",
      "Category": "Ice Creams",
      "Price (INR)": 25.0,
      "Barcode ID": "8901262010011",
      "Buffer Stock": 10,
      "Status": "active",
      "Is Favorite": "Yes",
      "Image URL": "/logo.png",
    },
    {
      "Product Name": "Heritage Toned Milk 500ml",
      "Category": "Dairy",
      "Price (INR)": 29.0,
      "Barcode ID": "8901582020018",
      "Buffer Stock": 20,
      "Status": "active",
      "Is Favorite": "No",
      "Image URL": "/logo.png",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleTemplate);
  worksheet["!cols"] = [
    { wch: 35 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products Template");
  XLSX.writeFile(workbook, fileName);
}

// Helper unique numeric barcode generator
export function generateFallbackBarcode(): string {
  const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  return `890${randomDigits}`;
}

// Flexible Excel Parser for user-uploaded files
export function parseExcelProducts(arrayBuffer: ArrayBuffer): {
  products: SampleProductData[];
  categories: Set<string>;
  errors: string[];
} {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  const products: SampleProductData[] = [];
  const categories = new Set<string>();
  const errors: string[] = [];

  rawRows.forEach((row, index) => {
    const rowNum = index + 2; // considering 1-based header row

    // Find Name column flexibly
    const name =
      row["Product Name"] ||
      row["product name"] ||
      row["Name"] ||
      row["name"] ||
      row["Item Name"] ||
      row["ITEM NAME"] ||
      "";

    if (!name || String(name).trim() === "") {
      errors.push(`Row ${rowNum}: Skipped because Product Name is missing.`);
      return;
    }

    // Find Category column
    const category =
      row["Category"] ||
      row["category"] ||
      row["Category Name"] ||
      row["CATEGORY"] ||
      "General";

    // Find Price column
    const rawPrice =
      row["Price (INR)"] ??
      row["Price"] ??
      row["price"] ??
      row["Rate"] ??
      row["MRP"] ??
      row["Unit Price"] ??
      0;
    const price = Math.max(0, Number(rawPrice) || 0);

    // Find Barcode column
    let rawBarcode =
      row["Barcode ID"] ??
      row["Barcode"] ??
      row["barcode"] ??
      row["SKU"] ??
      row["Code"] ??
      "";
    let barcode = String(rawBarcode).replace(/\D/g, "").trim();
    if (!barcode) {
      barcode = generateFallbackBarcode();
    }

    // Stock & Buffer Stock
    const rawStock =
      row["Current Stock"] ??
      row["Stock"] ??
      row["stock"] ??
      row["Qty"] ??
      row["Quantity"] ??
      10;
    const stock = Math.max(0, Math.floor(Number(rawStock) || 0));

    const rawBuffer =
      row["Buffer Stock"] ??
      row["buffer stock"] ??
      row["Buffer"] ??
      row["Min Stock"] ??
      5;
    const bufferStock = Math.max(0, Math.floor(Number(rawBuffer) || 0));

    // Status
    const rawStatus = String(row["Status"] || row["status"] || "active").toLowerCase().trim();
    const status: "active" | "inactive" = rawStatus === "inactive" ? "inactive" : "active";

    // Favorite
    const rawFav = String(row["Is Favorite"] || row["Favorite"] || row["isFavorite"] || "").toLowerCase();
    const isFavorite = rawFav === "yes" || rawFav === "true" || rawFav === "1";

    // Image URL - default to /logo.png if missing/blank
    const rawImg =
      row["Image URL"] ||
      row["Image"] ||
      row["image"] ||
      row["imageUrl"] ||
      row["ImageUrl"] ||
      "";
    const imageUrl = String(rawImg).trim() || "/logo.png";

    const cleanCategory = String(category).trim() || "General";
    categories.add(cleanCategory);

    products.push({
      name: String(name).trim(),
      category: cleanCategory,
      price,
      barcode,
      stock,
      bufferStock,
      status,
      isFavorite,
      imageUrl,
    });
  });

  return { products, categories, errors };
}
