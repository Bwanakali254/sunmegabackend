const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const Product = require('../models/Product')

const sampleProducts = [
  {
    name: 'Solar Panel 300W Monocrystalline',
    slug: 'solar-panel-300w-monocrystalline',
    description: 'High-efficiency monocrystalline solar panel with 300W power output. Perfect for residential and commercial installations. Features advanced cell technology for maximum energy conversion.',
    shortDescription: '300W monocrystalline solar panel with high efficiency',
    price: 45000,
    compareAtPrice: 50000,
    category: 'Energy Storage Systems',
    images: [
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800',
      'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800'
    ],
    specifications: {
      power: '300W',
      voltage: '24V',
      efficiency: '20%',
      warranty: '25 years',
      dimensions: '1956 x 992 x 40 mm',
      weight: '22.5 kg'
    },
    stock: 50,
    sku: 'SP-300W-MONO-001',
    rating: 4.5,
    reviewCount: 120,
    featured: true,
    active: true
  },
  {
    name: 'Lithium Battery 100Ah 12V',
    slug: 'lithium-battery-100ah-12v',
    description: 'Deep cycle lithium battery with 100Ah capacity at 12V. Ideal for solar energy storage systems. Long lifespan and maintenance-free operation.',
    shortDescription: '100Ah 12V lithium deep cycle battery',
    price: 35000,
    compareAtPrice: 40000,
    category: 'Batteries',
    images: [
      'https://images.unsplash.com/photo-1605792657660-596af9009a82?w=800'
    ],
    specifications: {
      capacity: '100Ah',
      voltage: '12V',
      warranty: '5 years',
      dimensions: '330 x 172 x 220 mm',
      weight: '12 kg'
    },
    stock: 30,
    sku: 'BAT-100AH-12V-001',
    rating: 4.7,
    reviewCount: 85,
    featured: true,
    active: true
  },
  {
    name: 'Solar Inverter 2000W Pure Sine Wave',
    slug: 'solar-inverter-2000w-pure-sine-wave',
    description: '2000W pure sine wave inverter with solar charging capability. Perfect for off-grid solar systems. Features LCD display and multiple protection systems.',
    shortDescription: '2000W pure sine wave solar inverter',
    price: 28000,
    compareAtPrice: 32000,
    category: 'Inverters',
    images: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800'
    ],
    specifications: {
      power: '2000W',
      voltage: '12V/24V',
      efficiency: '90%',
      warranty: '2 years',
      dimensions: '350 x 200 x 150 mm',
      weight: '5.5 kg'
    },
    stock: 25,
    sku: 'INV-2000W-PSW-001',
    rating: 4.6,
    reviewCount: 95,
    featured: true,
    active: true
  },
  {
    name: 'MPPT Solar Charge Controller 40A',
    slug: 'mppt-solar-charge-controller-40a',
    description: '40A MPPT solar charge controller with maximum power point tracking. Optimizes solar panel output and extends battery life.',
    shortDescription: '40A MPPT solar charge controller',
    price: 12000,
    compareAtPrice: 15000,
    category: 'Controllers',
    images: [
      'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800'
    ],
    specifications: {
      current: '40A',
      voltage: '12V/24V',
      efficiency: '98%',
      warranty: '2 years',
      dimensions: '200 x 150 x 60 mm',
      weight: '0.8 kg'
    },
    stock: 40,
    sku: 'MPPT-40A-001',
    rating: 4.8,
    reviewCount: 150,
    featured: false,
    active: true
  },
  {
    name: 'Portable Solar Power Station 500Wh',
    slug: 'portable-solar-power-station-500wh',
    description: 'Portable solar power station with 500Wh capacity. Perfect for camping, outdoor activities, and emergency backup power.',
    shortDescription: '500Wh portable solar power station',
    price: 55000,
    compareAtPrice: 65000,
    category: 'Portable Power',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64f?w=800'
    ],
    specifications: {
      capacity: '500Wh',
      output: 'AC 220V, USB, DC',
      warranty: '1 year',
      dimensions: '300 x 200 x 250 mm',
      weight: '6 kg'
    },
    stock: 15,
    sku: 'PPS-500WH-001',
    rating: 4.4,
    reviewCount: 65,
    featured: true,
    active: true
  },
  {
    name: 'DC to AC Converter 1000W',
    slug: 'dc-to-ac-converter-1000w',
    description: '1000W DC to AC converter for solar systems. Converts battery DC power to AC for household appliances.',
    shortDescription: '1000W DC to AC converter',
    price: 15000,
    compareAtPrice: 18000,
    category: 'Converters',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64f?w=800'
    ],
    specifications: {
      power: '1000W',
      input: '12V DC',
      output: '220V AC',
      warranty: '1 year',
      dimensions: '250 x 180 x 100 mm',
      weight: '2.5 kg'
    },
    stock: 35,
    sku: 'CONV-1000W-001',
    rating: 4.3,
    reviewCount: 45,
    featured: false,
    active: true
  }
]

async function seedProducts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    // Clear existing products (optional - comment out if you want to keep existing)
    // await Product.deleteMany({})
    // console.log('Cleared existing products')

    // Insert sample products
    const products = await Product.insertMany(sampleProducts)
    console.log(`✅ Successfully seeded ${products.length} products!`)
    
    // Display summary
    console.log('\n📦 Products added:')
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ${product.category} - KES ${product.price.toLocaleString()}`)
    })

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding products:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\nDatabase connection closed')
  }
}

// Run the seed function
seedProducts()

