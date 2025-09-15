// Yura Learning App - External Save System
// This file handles all data persistence with history tracking

class YuraSaveSystem {
    constructor() {
        this.version = '2.0';
        this.fileName = 'yura-learning-data.json';
    }

    // Create a complete snapshot of current data
    createSnapshot(data) {
        return {
            version: this.version,
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId(),
            data: {
                // Core learning data
                weekStartDate: data.weekStartDate,
                weeklyRewards: data.weeklyRewards || [],
                weeklyScore: data.weeklyScore || 0,
                weeklyKoreanScore: data.weeklyKoreanScore || 0,
                weeklyMathScore: data.weeklyMathScore || 0,
                mathLevel: data.mathLevel || 1,
                consecutiveCorrectKorean: data.consecutiveCorrectKorean || 0,
                consecutiveCorrectMath: data.consecutiveCorrectMath || 0,
                mistakes: data.mistakes || [],
                savedProblems: data.savedProblems || [],
                stats: data.stats || this.getDefaultStats(),
                
                // Session metadata
                totalSessions: (data.totalSessions || 0) + 1,
                lastLogin: new Date().toISOString()
            }
        };
    }

    // Generate unique session ID
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get default stats structure
    getDefaultStats() {
        const stats = { 
            math: {}, 
            korean: { 
                '어휘': { attempted: 0, correct: 0 }, 
                '속담': { attempted: 0, correct: 0 }, 
                '맞춤법': { attempted: 0, correct: 0 } 
            } 
        };
        for (let i = 1; i <= 10; i++) {
            stats.math[`level_${i}`] = { attempted: 0, correct: 0 };
        }
        return stats;
    }

    // Save data to file (for download)
    async saveToFile(data) {
        try {
            const snapshot = this.createSnapshot(data);
            
            // Load existing history or create new
            let fullData = {
                version: this.version,
                created: new Date().toISOString(),
                history: []
            };

            // Try to load existing data first
            const existingData = this.loadFromLocalStorage();
            if (existingData && existingData.history) {
                fullData = existingData;
            }

            // Add current snapshot to history
            fullData.history.push(snapshot);
            
            // Keep only last 20 sessions to prevent localStorage quota issues
            if (fullData.history.length > 20) {
                fullData.history = fullData.history.slice(-20);
            }

            // Update latest data
            fullData.latest = snapshot.data;
            fullData.lastUpdated = snapshot.timestamp;

            // Save to localStorage
            localStorage.setItem('yura_save_data', JSON.stringify(fullData));
            
            return fullData;
        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }

    // Load data from localStorage
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('yura_save_data');
            if (!savedData) return null;
            
            const parsed = JSON.parse(savedData);
            
            // Version check
            if (parsed.version !== this.version) {
                console.warn('Version mismatch, migrating data...');
                return this.migrateData(parsed);
            }
            
            return parsed;
        } catch (error) {
            console.error('Load error:', error);
            return null;
        }
    }

    // Load latest data
    loadLatestData() {
        const fullData = this.loadFromLocalStorage();
        if (!fullData || !fullData.latest) return null;
        
        // Check if data is too old (7 days)
        if (fullData.lastUpdated) {
            const daysDiff = (Date.now() - new Date(fullData.lastUpdated)) / (1000 * 60 * 60 * 24);
            if (daysDiff > 7) {
                console.log('Data older than 7 days, will be reset');
                return null;
            }
        }
        
        return fullData.latest;
    }

    // Export data to JSON file for download
    exportToFile() {
        const fullData = this.loadFromLocalStorage();
        if (!fullData) {
            alert('저장된 데이터가 없습니다.');
            return;
        }

        const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yura_learning_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Import data from JSON file
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    
                    // Validate structure
                    if (!imported.version || !imported.latest) {
                        throw new Error('Invalid backup file format');
                    }
                    
                    // Save to localStorage
                    localStorage.setItem('yura_save_data', JSON.stringify(imported));
                    resolve(imported.latest);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // Get statistics from history
    getHistoryStats() {
        const fullData = this.loadFromLocalStorage();
        if (!fullData || !fullData.history) return null;
        
        const stats = {
            totalSessions: fullData.history.length,
            firstSession: fullData.history[0]?.timestamp,
            lastSession: fullData.history[fullData.history.length - 1]?.timestamp,
            totalScore: 0,
            totalKoreanScore: 0,
            totalMathScore: 0,
            sessions: []
        };
        
        fullData.history.forEach((session, index) => {
            stats.totalScore += session.data.weeklyScore || 0;
            stats.totalKoreanScore += session.data.weeklyKoreanScore || 0;
            stats.totalMathScore += session.data.weeklyMathScore || 0;
            
            // Add session summary
            stats.sessions.push({
                index: index + 1,
                timestamp: session.timestamp,
                score: session.data.weeklyScore || 0,
                koreanScore: session.data.weeklyKoreanScore || 0,
                mathScore: session.data.weeklyMathScore || 0,
                mathLevel: session.data.mathLevel || 1
            });
        });
        
        return stats;
    }

    // Clear all saved data
    clearAllData() {
        localStorage.removeItem('yura_save_data');
        // Clear old keys too
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('learningApp_')) {
                localStorage.removeItem(key);
            }
        });
    }
    
    // Clean up storage to prevent quota issues
    cleanupStorage() {
        try {
            const fullData = this.loadFromLocalStorage();
            if (!fullData) return;
            
            // Keep only recent history
            if (fullData.history && fullData.history.length > 10) {
                fullData.history = fullData.history.slice(-10);
            }
            
            // Limit saved problems to 50
            if (fullData.latest && fullData.latest.savedProblems && fullData.latest.savedProblems.length > 50) {
                fullData.latest.savedProblems = fullData.latest.savedProblems.slice(-50);
            }
            
            // Limit mistakes to 30
            if (fullData.latest && fullData.latest.mistakes && fullData.latest.mistakes.length > 30) {
                fullData.latest.mistakes = fullData.latest.mistakes.slice(-30);
            }
            
            localStorage.setItem('yura_save_data', JSON.stringify(fullData));
            console.log('Storage cleaned up successfully');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Migrate old data format to new format
    migrateData(oldData) {
        console.log('Migrating old data format...');
        
        const migrated = {
            version: this.version,
            created: oldData.created || new Date().toISOString(),
            history: oldData.history || [],
            latest: oldData.latest || {},
            lastUpdated: oldData.lastUpdated || new Date().toISOString()
        };
        
        // Ensure stats have the correct structure
        if (migrated.latest.stats) {
            if (!migrated.latest.stats.korean) {
                migrated.latest.stats.korean = this.getDefaultStats().korean;
            }
            if (!migrated.latest.stats.math) {
                migrated.latest.stats.math = this.getDefaultStats().math;
            }
        } else {
            migrated.latest.stats = this.getDefaultStats();
        }
        // Ensure savedProblems exists
        if (!migrated.latest.savedProblems) {
            migrated.latest.savedProblems = [];
        }
        
        return migrated;
    }
}

// Export for use in main file
window.YuraSaveSystem = YuraSaveSystem;