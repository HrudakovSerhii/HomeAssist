/**
 * Embedding Service Demonstration
 * 
 * This script demonstrates how the EmbeddingService classifies email subjects
 * and selects appropriate templates based on the classification.
 * 
 * Usage: Run this script to see sample classifications
 */

import { EmbeddingService } from './embedding.service';

// Sample email subjects for testing
const SAMPLE_EMAILS = [
  {
    subject: "Invoice #12345 - Payment Due Tomorrow",
    expectedCategory: "INVOICE",
    description: "Payment reminder with urgency"
  },
  {
    subject: "Team Meeting - Project Review Next Tuesday 2PM",
    expectedCategory: "APPOINTMENT", 
    description: "Meeting invitation with specific time"
  },
  {
    subject: "50% Off Sale - Limited Time Offer!",
    expectedCategory: "MARKETING",
    description: "Promotional email with discount"
  },
  {
    subject: "Weekly Newsletter - Tech Updates & Industry News",
    expectedCategory: "NEWSLETTER",
    description: "Regular newsletter content"
  },
  {
    subject: "Purchase Receipt - Order #98765 Confirmed",
    expectedCategory: "RECEIPT", 
    description: "Transaction confirmation"
  },
  {
    subject: "Help needed with login issues",
    expectedCategory: "SUPPORT",
    description: "Customer support request"
  },
  {
    subject: "Happy Birthday! Hope you have a wonderful day",
    expectedCategory: "PERSONAL",
    description: "Personal message from friend/family"
  },
  {
    subject: "System Alert: Server maintenance scheduled",
    expectedCategory: "NOTIFICATION",
    description: "Automated system notification"
  },
  {
    subject: "Q4 Budget Review Meeting - Action Required",
    expectedCategory: "WORK",
    description: "Business communication"
  }
];

async function demonstrateEmbeddingClassification() {
  console.log('🚀 Starting Embedding Service Demonstration\n');
  
  const embeddingService = new EmbeddingService();
  
  try {
    // Initialize the service (this will download the model and precompute embeddings)
    console.log('📥 Initializing EmbeddingService (this may take 10-30 seconds)...');
    await embeddingService.onModuleInit();
    
    if (!embeddingService.isReady()) {
      console.error('❌ EmbeddingService failed to initialize');
      return;
    }
    
    console.log('✅ EmbeddingService initialized successfully!\n');
    console.log('📧 Classifying sample email subjects:\n');
    
    let correctPredictions = 0;
    
    for (const email of SAMPLE_EMAILS) {
      try {
        const classification = await embeddingService.classifyEmailSubject(email.subject);
        const template = embeddingService.getCategoryTemplate(classification.category);
        
        const isCorrect = classification.category === email.expectedCategory;
        if (isCorrect) correctPredictions++;
        
        const icon = isCorrect ? '✅' : '❌';
        const confidence = (classification.confidence * 100).toFixed(1);
        
        console.log(`${icon} "${email.subject}"`);
        console.log(`   Expected: ${email.expectedCategory} | Predicted: ${classification.category}`);
        console.log(`   Confidence: ${confidence}% | Template: ${template}`);
        console.log(`   Description: ${email.description}`);
        
        // Show top 3 category scores
        const sortedScores = Object.entries(classification.scores)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        
        console.log(`   Top scores: ${sortedScores.map(([cat, score]) => 
          `${cat}(${(score * 100).toFixed(1)}%)`
        ).join(', ')}`);
        console.log('');
        
      } catch (error) {
        console.error(`❌ Failed to classify: "${email.subject}"`, error.message);
      }
    }
    
    const accuracy = (correctPredictions / SAMPLE_EMAILS.length * 100).toFixed(1);
    console.log(`📊 Overall Accuracy: ${correctPredictions}/${SAMPLE_EMAILS.length} (${accuracy}%)`);
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  }
}

// Export for potential use in tests or other modules
export { demonstrateEmbeddingClassification, SAMPLE_EMAILS };

// Run demonstration if this file is executed directly
if (require.main === module) {
  demonstrateEmbeddingClassification()
    .then(() => {
      console.log('\n🎉 Demonstration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demonstration failed:', error);
      process.exit(1);
    });
} 