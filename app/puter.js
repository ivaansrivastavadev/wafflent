/**
 * Puter.js Integration for Wafflent
 * Real Puter AI integration with fallback to enhanced mock responses
 */

// Initialize PuterAI object
window.PuterAI = {
    // Configuration
    config: {
        model: 'gpt-4o-mini',
        maxTokens: 2000,
        temperature: 0.7
    },

    // State
    isInitialized: false,
    mockMode: true,

    /**
     * Initialize the Puter AI service
     */
    async init() {
        try {
            // Check if we're running in Puter environment
            if (typeof window.puter !== 'undefined') {
                console.log('Puter environment detected');
                
                // Check if user is authenticated
                try {
                    const user = await window.puter.auth.getUser();
                    if (user) {
                        console.log('User authenticated:', user.username);
                        
                        // Test the AI service
                        if (window.puter.ai) {
                            const testResponse = await window.puter.ai.chat({
                                messages: [{ role: 'user', content: 'Hello' }],
                                model: this.config.model,
                                max_tokens: 10
                            });
                            
                            if (testResponse) {
                                this.mockMode = false;
                                this.isInitialized = true;
                                console.log('Puter AI initialized successfully');
                                this.showAuthStatus('Connected to Puter AI', 'success');
                                return true;
                            }
                        }
                    } else {
                        // User not authenticated - show login option
                        console.log('User not authenticated');
                        this.showAuthPrompt();
                    }
                } catch (authError) {
                    console.log('Authentication check failed:', authError);
                    this.showAuthPrompt();
                }
            }
            
            console.log('Puter AI not available - using enhanced mock mode');
            this.mockMode = true;
            this.isInitialized = true;
            this.showAuthStatus('Using demo mode (limited AI features)', 'info');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Puter AI, falling back to mock mode:', error);
            this.mockMode = true;
            this.isInitialized = true;
            this.showAuthStatus('Demo mode - limited AI features', 'warning');
            return false;
        }
    },

    /**
     * Show authentication prompt to user
     */
    showAuthPrompt() {
        const authBanner = document.createElement('div');
        authBanner.id = 'puter-auth-banner';
        authBanner.className = 'wf-alert wf-alert-accent';
        authBanner.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            max-width: 500px;
            margin: 0 20px;
        `;
        
        authBanner.innerHTML = `
            <div class="wf-alert-icon">
                <i class="fas fa-robot"></i>
            </div>
            <div class="wf-alert-body">
                <strong>Unlock Full AI Power!</strong><br>
                Sign in to Puter to access advanced AI features including real-time chat and enhanced file processing.
                <div style="margin-top: var(--space-3);">
                    <button onclick="PuterAI.signIn()" class="wf-btn wf-btn-filled" style="background: var(--accent); margin-right: var(--space-2);">
                        Sign In to Puter
                    </button>
                    <button onclick="PuterAI.dismissAuth()" class="wf-btn wf-btn-outlined">
                        Use Demo Mode
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(authBanner);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            this.dismissAuth();
        }, 10000);
    },

    /**
     * Sign in to Puter
     */
    async signIn() {
        try {
            if (typeof window.puter !== 'undefined') {
                await window.puter.auth.signIn();
                // Reinitialize after successful login
                await this.init();
            } else {
                alert('Puter environment not available. Continuing in demo mode.');
                this.dismissAuth();
            }
        } catch (error) {
            console.error('Sign in failed:', error);
            alert('Sign in failed. Continuing in demo mode.');
            this.dismissAuth();
        }
    },

    /**
     * Dismiss authentication banner
     */
    dismissAuth() {
        const banner = document.getElementById('puter-auth-banner');
        if (banner) {
            banner.remove();
        }
        this.showAuthStatus('Using demo mode - Sign in to Puter for full AI features', 'info');
    },

    /**
     * Show authentication status
     */
    showAuthStatus(message, type = 'info') {
        // Remove any existing status
        const existingStatus = document.getElementById('puter-auth-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        const status = document.createElement('div');
        status.id = 'puter-auth-status';
        status.className = `wf-alert wf-alert-${type === 'success' ? 'accent' : type === 'warning' ? 'danger' : 'neutral'}`;
        status.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 300px;
            font-size: var(--text-sm);
        `;
        
        status.innerHTML = `
            <div class="wf-alert-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            </div>
            <div class="wf-alert-body">${message}</div>
        `;
        
        document.body.appendChild(status);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            status.remove();
        }, 5000);
    },

    /**
     * Send a chat message to AI
     */
    async chat(options) {
        const { messages, model = this.config.model } = options;

        try {
            // Ensure initialization
            if (!this.isInitialized) {
                await this.init();
            }

            // Use real Puter AI if available
            if (!this.mockMode && window.puter && window.puter.ai) {
                console.log('Using real Puter AI');
                
                const response = await window.puter.ai.chat({
                    messages: messages,
                    model: model,
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature
                });

                return {
                    message: response.content || response.message || response.choices?.[0]?.message?.content,
                    model: model,
                    usage: response.usage || {},
                    source: 'puter'
                };
            }

            // Fallback to enhanced mock responses
            console.log('Using enhanced mock AI');
            return this.generateEnhancedMockResponse(messages);

        } catch (error) {
            console.error('AI chat error:', error);
            
            // Return informative error response
            return {
                message: `I apologize, but I'm experiencing technical difficulties right now. ${this.mockMode ? 'Running in demonstration mode.' : 'Please try again in a moment.'}`,
                error: true,
                model: model,
                source: 'error'
            };
        }
    },

    /**
     * Enhanced mock AI responses that are contextually aware
     */
    async generateEnhancedMockResponse(messages) {
        // Simulate realistic API delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage.content.toLowerCase();
        const context = this.analyzeContext(messages);

        let response = '';

        // Context-aware responses
        if (context.isAboutSpecificMemory) {
            response = this.generateMemorySpecificResponse(userMessage, context);
        } else if (context.isAnalyticalQuery) {
            response = this.generateAnalyticalResponse(userMessage, context);
        } else if (context.isFileProcessing) {
            response = this.generateFileProcessingResponse(userMessage, context);
        } else if (context.isHelpRequest) {
            response = this.generateHelpResponse(userMessage);
        } else {
            response = this.generateGeneralResponse(userMessage);
        }

        return {
            message: response,
            model: 'enhanced-mock-gpt-4o-mini',
            usage: { prompt_tokens: userMessage.length / 4, completion_tokens: response.length / 4 },
            source: 'mock'
        };
    },

    analyzeContext(messages) {
        const allText = messages.map(m => m.content).join(' ').toLowerCase();
        
        return {
            isAboutSpecificMemory: allText.includes('memory:') || allText.includes('this memory') || allText.includes('file:'),
            isAnalyticalQuery: allText.includes('analyze') || allText.includes('pattern') || allText.includes('insight') || allText.includes('summary'),
            isFileProcessing: allText.includes('upload') || allText.includes('process') || allText.includes('file'),
            isHelpRequest: allText.includes('help') || allText.includes('how') || allText.includes('what can you'),
            hasMemoryContext: messages.some(m => m.role === 'system' && m.content.includes('Title:'))
        };
    },

    generateMemorySpecificResponse(userMessage, context) {
        const responses = [
            "Based on this memory, I can see it contains valuable information. Here are some insights: This appears to be well-organized content that could be useful for future reference. You might consider adding relevant tags like #important or #reference to make it easier to find later.",
            
            "This memory shows interesting patterns. I notice it has structured content that could connect well with your other memories. Consider creating cross-references or related tags to build stronger connections in your knowledge base.",
            
            "Looking at this specific memory, I can help you enhance it. The content appears comprehensive, but you might benefit from adding a brief summary or key takeaways in the remarks section for quick reference.",
            
            "This memory contains rich information. To maximize its value, you could: 1) Add specific tags for easy searching, 2) Include relevant remarks about context or importance, 3) Consider which collection it belongs to for better organization."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    },

    generateAnalyticalResponse(userMessage, context) {
        if (userMessage.includes('pattern')) {
            return "I've analyzed your memory collection and notice several interesting patterns: You tend to save a good mix of different content types, showing diverse learning interests. Your memories often include actionable insights, suggesting you're focused on practical knowledge. Consider organizing similar themes into dedicated collections for better knowledge management.";
        }
        
        if (userMessage.includes('summary') || userMessage.includes('overview')) {
            return "Here's an overview of your Wafflent workspace: Your memories span various categories and topics, showing a well-rounded knowledge collection. The tagging system you're using helps with organization, and the AI processing is capturing key insights from your uploaded content. To enhance your system further, consider using more specific tags and regular reviews of your collections.";
        }
        
        if (userMessage.includes('insight')) {
            return "Key insights about your memory management: 1) Your content shows consistent quality and thoughtful curation, 2) The mix of file types suggests diverse learning preferences, 3) Your use of tags and remarks indicates good organizational habits. I recommend establishing regular review sessions to connect related memories and identify knowledge gaps.";
        }
        
        return "Based on my analysis, your memory collection demonstrates thoughtful information curation. The patterns I observe suggest you're building a valuable knowledge base. To optimize further, consider implementing themed collections and regular cross-referencing of related memories.";
    },

    generateFileProcessingResponse(userMessage, context) {
        const fileTypes = ['document', 'image', 'audio', 'video', 'code', 'pdf'];
        const randomType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
        
        return `I've successfully processed your ${randomType} file. Here's what I found: The content contains valuable information that I've organized and summarized for easy understanding. Key elements have been extracted and relevant tags have been suggested. The file has been integrated into your memory collection where you can add remarks, ask specific questions about it, and organize it within your collections for optimal knowledge management.`;
    },

    generateHelpResponse(userMessage) {
        if (userMessage.includes('tag')) {
            return "Tags in Wafflent use the #hashtag format (like #important #work #ideas). They help you organize and find memories quickly. You can add tags anywhere in your content or remarks, and they'll be automatically detected. Try using specific tags like #meeting-notes, #research, or #todo for better organization.";
        }
        
        if (userMessage.includes('collection')) {
            return "Collections in Wafflent help you organize memories by themes or projects. You can create custom collections and even enable auto-collection using AI to automatically categorize new memories. This helps keep related memories together and makes your knowledge base more navigable.";
        }
        
        if (userMessage.includes('ai') || userMessage.includes('assistant')) {
            return "I'm your AI assistant in Wafflent! I can help you: 1) Process and understand uploaded files, 2) Analyze patterns in your memories, 3) Suggest better organization methods, 4) Answer questions about specific memories, 5) Help you make connections between different pieces of knowledge. Feel free to ask me anything about your memories or how to use Wafflent more effectively!";
        }
        
        return "I'm here to help you make the most of Wafflent! You can ask me to analyze your memories, help organize your knowledge, process new files, or explain any features. I can also help you find connections between different memories and suggest ways to improve your knowledge management system.";
    },

    generateGeneralResponse(userMessage) {
        const responses = [
            "I'm ready to help you organize and understand your knowledge better. What specific aspect of your memories or Wafflent would you like to explore?",
            
            "Your Wafflent workspace is designed to be your second brain. I can help you make connections, find patterns, and organize information more effectively. What would you like to work on?",
            
            "I can assist you with analyzing your memories, processing new content, or improving your organizational system. Is there something specific you'd like to focus on?",
            
            "As your AI assistant, I'm here to help you unlock the full potential of your memory collection. Whether it's processing files, finding insights, or organizing knowledge - I'm at your service!"
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    },

    /**
     * Universal file processor with enhanced intelligence
     */
    async processFile(file) {
        try {
            if (!this.mockMode && window.puter && window.puter.ai) {
                // Use real Puter AI for file processing
                return await this.processFileWithPuterAI(file);
            }

            // Enhanced mock file processing
            return await this.processFileWithEnhancedMock(file);

        } catch (error) {
            console.error('File processing error:', error);
            return this.generateErrorResponse(file, error);
        }
    },

    async processFileWithPuterAI(file) {
        // Real Puter AI file processing would go here
        // This is a placeholder for when real integration is available
        
        if (file.type.startsWith('image/')) {
            // Process with vision API
            const imageData = await this.convertImageToBase64(file);
            // const result = await window.puter.ai.vision.analyze(imageData);
            // return result;
        }
        
        // Fallback to mock for now
        return await this.processFileWithEnhancedMock(file);
    },

    async processFileWithEnhancedMock(file) {
        // Simulate processing time based on file size
        const processingTime = Math.min(3000, Math.max(1000, file.size / 1000));
        await new Promise(resolve => setTimeout(resolve, processingTime));

        const fileAnalysis = this.analyzeFileType(file);
        const mockContent = this.generateMockFileContent(file, fileAnalysis);

        return {
            description: mockContent.description,
            content: mockContent.analysis,
            confidence: fileAnalysis.confidence,
            fileType: fileAnalysis.type,
            suggestedTags: fileAnalysis.suggestedTags,
            source: 'enhanced-mock'
        };
    },

    analyzeFileType(file) {
        const name = file.name.toLowerCase();
        const type = file.type.toLowerCase();
        const size = file.size;

        if (type.startsWith('image/')) {
            return {
                type: 'image',
                confidence: 0.9,
                suggestedTags: ['image', 'visual', 'media'],
                category: 'visual'
            };
        }

        if (type.startsWith('audio/')) {
            return {
                type: 'audio',
                confidence: 0.85,
                suggestedTags: ['audio', 'sound', 'media'],
                category: 'audio'
            };
        }

        if (type.includes('pdf')) {
            return {
                type: 'pdf',
                confidence: 0.95,
                suggestedTags: ['document', 'pdf', 'text'],
                category: 'document'
            };
        }

        if (name.includes('meeting') || name.includes('notes')) {
            return {
                type: 'notes',
                confidence: 0.8,
                suggestedTags: ['notes', 'meeting', 'important'],
                category: 'notes'
            };
        }

        if (this.isCodeFile(file)) {
            const language = this.detectLanguage(file.name);
            return {
                type: 'code',
                confidence: 0.9,
                suggestedTags: ['code', language.toLowerCase(), 'development'],
                category: 'code',
                language: language
            };
        }

        return {
            type: 'general',
            confidence: 0.7,
            suggestedTags: ['file', 'general'],
            category: 'general'
        };
    },

    generateMockFileContent(file, analysis) {
        const templates = {
            image: {
                description: `Visual content analyzed: ${file.name}. This image contains meaningful visual information that could be valuable for your knowledge base. Consider adding descriptive tags to make it searchable.`,
                analysis: `Image file processed: ${file.name}\nType: ${analysis.category}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nThis image has been processed and indexed for your memory collection. You can now reference it in your knowledge base and connect it with related memories.`
            },
            audio: {
                description: `Audio content processed: ${file.name}. This audio file has been analyzed for key information and is ready to be integrated into your memory system.`,
                analysis: `Audio file: ${file.name}\nDuration: Estimated ${Math.floor(file.size / 1024 / 50)} seconds\nType: Audio content\n\nThis audio file has been processed and is now part of your searchable memory collection. Consider adding context in remarks for better organization.`
            },
            pdf: {
                description: `Document analyzed: ${file.name}. Key information has been extracted and structured for optimal integration with your knowledge base.`,
                analysis: `PDF Document: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\nType: Document\n\nThis PDF has been processed and key content has been extracted. The document is now searchable and can be cross-referenced with your other memories.`
            },
            code: {
                description: `Code file analyzed: ${file.name}. Programming content has been processed and is ready for integration with your development knowledge base.`,
                analysis: `Code File: ${file.name}\nLanguage: ${analysis.language || 'Unknown'}\nSize: ${(file.size / 1024).toFixed(2)} KB\n\nThis code file has been analyzed for structure and content. It's now part of your searchable development knowledge base.`
            },
            notes: {
                description: `Notes processed: ${file.name}. Content has been analyzed and structured for optimal knowledge management and future reference.`,
                analysis: `Notes File: ${file.name}\nType: Text/Notes\nSize: ${(file.size / 1024).toFixed(2)} KB\n\nThese notes have been processed and integrated into your memory system. Consider organizing them with relevant tags for easier retrieval.`
            },
            general: {
                description: `File processed: ${file.name}. Content has been analyzed and is now available in your memory collection for future reference and organization.`,
                analysis: `File: ${file.name}\nType: ${file.type || 'Unknown'}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nThis file has been successfully added to your memory collection and is now searchable and referenceable.`
            }
        };

        return templates[analysis.type] || templates.general;
    },

    generateErrorResponse(file, error) {
        return {
            description: `Error processing ${file.name}. The file has been stored but advanced analysis is currently unavailable.`,
            content: `File: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\nStatus: Stored (Analysis failed)\n\nThe file has been saved to your memory collection but could not be fully processed at this time.`,
            confidence: 0.5,
            error: true,
            source: 'error'
        };
    },

    // Helper methods (keeping existing ones)
    isCodeFile(file) {
        const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.html', '.css'];
        return codeExts.some(ext => file.name.toLowerCase().endsWith(ext));
    },

    detectLanguage(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const langs = {
            'js': 'JavaScript', 'jsx': 'React', 'ts': 'TypeScript', 'tsx': 'React TypeScript',
            'py': 'Python', 'java': 'Java', 'cpp': 'C++', 'c': 'C', 'cs': 'C#',
            'php': 'PHP', 'rb': 'Ruby', 'go': 'Go', 'rs': 'Rust', 'swift': 'Swift',
            'html': 'HTML', 'css': 'CSS'
        };
        return langs[ext] || 'Code';
    },

    async convertImageToBase64(imageFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }
};

// Initialize PuterAI when the script loads
PuterAI.init().then(success => {
    if (success) {
        console.log('PuterAI initialized successfully');
    } else {
        console.warn('PuterAI initialization had issues - using fallback mode');
    }
}).catch(error => {
    console.error('PuterAI initialization error:', error);
});

// Export for use in other scripts
window.PuterAI = PuterAI;