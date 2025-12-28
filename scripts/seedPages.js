const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const mongoose = require('mongoose')
const Page = require('../models/Page')

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not defined in .env file')
      process.exit(1)
    }
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('MongoDB Connected')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    process.exit(1)
  }
}

const seedPages = async () => {
  try {
    await connectDB()

    const defaultPages = [
      {
        slug: 'home',
        title: 'Home',
        metaDescription: 'Sun Mega Limited - Powering Souls, Lighting Futures',
        sections: [
          {
            type: 'heading',
            content: 'Welcome to Sun Mega Limited',
            order: 0
          },
          {
            type: 'text',
            content: 'Your trusted partner for solar energy solutions. We provide high-quality solar products and services to power your future.',
            order: 1
          }
        ],
        isActive: true
      },
      {
        slug: 'about',
        title: 'About Us',
        metaDescription: 'Learn about Sun Mega Limited - Powering Souls, Lighting Futures',
        sections: [
          {
            type: 'heading',
            content: 'Our Story',
            order: 0
          },
          {
            type: 'text',
            content: 'Sun Mega Limited was born from a vision to merge soulful living with sustainable energy. Starting in Mombasa, the company set out to empower communities through light and clean power. What began as a local initiative has grown into a brand that celebrates milestones with heart, nurtures relationships with suppliers and clients, and builds bridges between tradition and innovation.',
            order: 1
          },
          {
            type: 'heading',
            content: 'Vision',
            order: 2
          },
          {
            type: 'text',
            content: 'To become Africa\'s most soulful solar brand — illuminating lives, inspiring communities, and creating sustainable futures across the continent.',
            order: 3
          },
          {
            type: 'heading',
            content: 'Mission',
            order: 4
          },
          {
            type: 'text',
            content: 'To deliver accessible, reliable, and soulful solar solutions that empower individuals, businesses, and communities while nurturing the environment and celebrating human connection.',
            order: 5
          }
        ],
        isActive: true
      },
      {
        slug: 'products',
        title: 'Products',
        metaDescription: 'Browse our range of solar energy products',
        sections: [
          {
            type: 'heading',
            content: 'Our Products',
            order: 0
          },
          {
            type: 'text',
            content: 'Explore our wide range of high-quality solar energy products including batteries, inverters, energy storage systems, converters, controllers, and portable power solutions.',
            order: 1
          }
        ],
        isActive: true
      },
      {
        slug: 'contact',
        title: 'Contact Us',
        metaDescription: 'Get in touch with Sun Mega Limited',
        sections: [
          {
            type: 'heading',
            content: 'Contact Information',
            order: 0
          },
          {
            type: 'text',
            content: 'We\'d love to hear from you. Reach out to us for any inquiries, support, or partnership opportunities.',
            order: 1
          }
        ],
        isActive: true
      },
      {
        slug: 'privacy-policy',
        title: 'Privacy Policy',
        metaDescription: 'Sun Mega Limited Privacy Policy',
        sections: [
          {
            type: 'heading',
            content: 'Privacy Policy',
            order: 0
          },
          {
            type: 'text',
            content: 'Your privacy is important to us. This privacy policy explains how we collect, use, and protect your personal information. We are committed to protecting your privacy and ensuring the security of your personal data.',
            order: 1
          }
        ],
        isActive: true
      },
      {
        slug: 'terms-of-service',
        title: 'Terms of Service',
        metaDescription: 'Sun Mega Limited Terms of Service',
        sections: [
          {
            type: 'heading',
            content: 'Terms of Service',
            order: 0
          },
          {
            type: 'text',
            content: 'By using our services, you agree to these terms and conditions. Please read them carefully before using our website or services.',
            order: 1
          }
        ],
        isActive: true
      }
    ]

    for (const pageData of defaultPages) {
      const existingPage = await Page.findOne({ slug: pageData.slug })
      if (!existingPage) {
        await Page.create(pageData)
        console.log(`Created page: ${pageData.slug}`)
      } else {
        console.log(`Page already exists: ${pageData.slug}`)
      }
    }

    console.log('Pages seeded successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding pages:', error)
    process.exit(1)
  }
}

seedPages()

