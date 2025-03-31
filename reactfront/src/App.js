import React, { useState, useEffect } from 'react';
import init, { next_beta_reduction_wasm } from './lambdawasm';

function App() {
  const [expression, setExpression] = useState('(λx.x) y');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedExpressions, setSavedExpressions] = useState({});
  const [newExpressionName, setNewExpressionName] = useState('');
  const [newExpressionValue, setNewExpressionValue] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Initialize the WASM module
    init()
      .then(() => {
        setLoading(false);
        // Load saved expressions from localStorage
        const saved = localStorage.getItem('savedExpressions');
        if (saved) {
          setSavedExpressions(JSON.parse(saved));
        }
      })
      .catch((err) => {
        console.error("WASM init failed", err);
        setError("Failed to initialize WASM module: " + err.message);
      });
  }, []);

  // Save expressions to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(savedExpressions).length > 0) {
      localStorage.setItem('savedExpressions', JSON.stringify(savedExpressions));
    }
  }, [savedExpressions]);

  const handleBetaReduce = () => {
    try {
      const replacedExpression = replaceNamedExpressions(expression);
      const result = next_beta_reduction_wasm(replacedExpression);
      if (result === expression) {
        setError("No further reduction possible.");
        return;
      }
      setHistory([...history, { from: expression, to: result }]);
      setExpression(result);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Error: " + err);
    }
  };

  const saveExpression = () => {
    if (!newExpressionName.trim() || !newExpressionValue.trim()) {
      setError("Both name and expression are required");
      return;
    }
    
    setSavedExpressions({
      ...savedExpressions,
      [newExpressionName.trim()]: newExpressionValue.trim()
    });
    setNewExpressionName('');
    setNewExpressionValue('');
    setError(null);
  };

  const deleteExpression = (name) => {
    const newExpressions = { ...savedExpressions };
    delete newExpressions[name];
    setSavedExpressions(newExpressions);
  };

  const replaceNamedExpressions = (expr) => {
    let result = expr;
    Object.entries(savedExpressions).forEach(([name, value]) => {
      // Use regex to replace all occurrences of the name with its value
      // Only replace when the name is a standalone identifier
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };

  const applyExpression = (expr) => {
    setExpression(expr);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading WASM module...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Saved Expressions</h2>
        
        {/* Add new expression form */}
        <div style={styles.addExpressionForm}>
          <input
            type="text"
            value={newExpressionName}
            onChange={(e) => setNewExpressionName(e.target.value)}
            placeholder="Name"
            style={styles.input}
          />
          <input
            type="text"
            value={newExpressionValue}
            onChange={(e) => setNewExpressionValue(e.target.value)}
            placeholder="λ expression"
            style={styles.input}
          />
          <button
            onClick={saveExpression}
            style={styles.saveButton}
          >
            Save Expression
          </button>
        </div>
        
        {/* List of saved expressions */}
        <div style={styles.expressionsList}>
          {Object.entries(savedExpressions).length === 0 ? (
            <p style={styles.noExpressions}>No saved expressions yet.</p>
          ) : (
            Object.entries(savedExpressions).map(([name, value]) => (
              <div key={name} style={styles.expressionCard}>
                <div style={styles.expressionHeader}>
                  <span style={styles.expressionName}>{name}</span>
                  <button
                    onClick={() => deleteExpression(name)}
                    style={styles.deleteButton}
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.expressionValue}>{value}</div>
                <button
                  onClick={() => applyExpression(value)}
                  style={styles.useButton}
                >
                  Use
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div style={styles.mainContent}>
        <h1 style={styles.mainTitle}>Lambda Playground</h1>
        
        {/* Expression input */}
        <div style={styles.inputContainer}>
          <label htmlFor="expression" style={styles.label}>
            Enter Lambda Expression:
          </label>
          <textarea
            id="expression"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            rows={4}
            placeholder="Enter a lambda expression, e.g., (λx.x) y"
            style={styles.textarea}
          />
        </div>
        
        {/* Beta reduction button */}
        <button
          onClick={handleBetaReduce}
          style={styles.betaReduceButton}
        >
          Beta Reduce
        </button>
        
        {/* Error display */}
        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}
        
        {/* Reduction history */}
        {history.length > 0 && (
          <div style={styles.historyContainer}>
            <div style={styles.historyHeader}>
              <h2 style={styles.historyTitle}>Reduction History</h2>
              <button
                onClick={clearHistory}
                style={styles.clearHistoryButton}
              >
                Clear History
              </button>
            </div>
            <div style={styles.historyList}>
              {history.map((step, index) => (
                <div key={index} style={styles.historyItem}>
                  <div style={styles.historyItemContent}>
                    {step.from} <span style={styles.arrow}>→</span> {step.to}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS Styles object
const styles = {
  appContainer: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'sans-serif',
    backgroundColor: '#f5f5f5',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    boxShadow: '2px 0 5px rgba(0, 0, 0, 0.1)',
    padding: '16px',
    overflowY: 'auto',
  },
  sidebarTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
  },
  addExpressionForm: {
    marginBottom: '24px',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    marginBottom: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  saveButton: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: '#4a86e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  expressionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  noExpressions: {
    color: '#999',
    fontSize: '14px',
  },
  expressionCard: {
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    border: '1px solid #eee',
  },
  expressionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  expressionName: {
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ff4d4f',
    cursor: 'pointer',
    fontSize: '14px',
  },
  expressionValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: '8px',
    wordBreak: 'break-all',
  },
  useButton: {
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  mainContent: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '24px',
    color: '#333',
  },
  inputContainer: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#333',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  betaReduceButton: {
    padding: '10px 16px',
    backgroundColor: '#4a86e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  errorBox: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#d32f2f',
    borderRadius: '4px',
    border: '1px solid #ffcdd2',
  },
  historyContainer: {
    marginTop: '24px',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  historyTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#333',
    margin: 0,
  },
  clearHistoryButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '14px',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    border: '1px solid #eee',
  },
  historyItemContent: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#333',
  },
  arrow: {
    color: '#4a86e8',
    fontWeight: 'bold',
    margin: '0 8px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  },
  loadingBox: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #4a86e8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#333',
    margin: 0,
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
};

export default App;