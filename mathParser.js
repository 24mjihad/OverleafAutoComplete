const MathParser = {
    evaluate: function (latex) {
        try {
            let expr = this.sanitize(latex);
            if (!expr || expr.trim() === '') {
                return null;
            }
            
            // Use our custom CSP-safe evaluator
            const result = this.safeEval(expr);
            
            if (result !== null && typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6));
            }
        } catch (e) {
            // Silently fail in production
        }
        return null;
    },

    sanitize: function (latex) {
        let clean = latex;

        // Handle fractions: \frac{num}{den} -> (num)/(den)
        while (clean.includes('\\frac')) {
            let next = clean.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
            if (next === clean) break;
            clean = next;
        }

        // Replace math operators
        clean = clean.replace(/\\cdot/g, '*');
        clean = clean.replace(/\\times/g, '*');
        clean = clean.replace(/\\div/g, '/');
        
        // Handle common constants
        clean = clean.replace(/\\pi/g, String(Math.PI));
        
        // Handle \left( \right) etc.
        clean = clean.replace(/\\left\(/g, '(');
        clean = clean.replace(/\\right\)/g, ')');
        clean = clean.replace(/\\left\[/g, '(');
        clean = clean.replace(/\\right\]/g, ')');
        
        // Replace braces with parentheses
        clean = clean.replace(/\{/g, '(').replace(/\}/g, ')');

        // Handle implicit multiplication: digit( -> digit*( and )digit -> )*digit and )( -> )*(
        clean = clean.replace(/(\d)\(/g, '$1*(');
        clean = clean.replace(/\)(\d)/g, ')*$1');
        clean = clean.replace(/\)\(/g, ')*(');
        
        // Strip any remaining LaTeX commands
        clean = clean.replace(/\\[a-zA-Z]+/g, '');
        
        // Strip non-math characters like $
        clean = clean.replace(/\$/g, '');
        
        return clean.trim();
    },

    // CSP-Safe Evaluator (Basic Recursive Descent Parser)
    safeEval: function(expr) {
        try {
            const tokens = expr.match(/\d+\.?\d*|[\+\-\*\/\(\)]/g);
            if (!tokens) return null;

            let pos = 0;

            function parsePrimary() {
                let token = tokens[pos++];
                if (token === '(') {
                    let val = parseExpression();
                    pos++; // skip ')'
                    return val;
                }
                if (token === '-') { // Unary minus
                    return -parsePrimary();
                }
                return parseFloat(token);
            }

            function parseMultiplicative() {
                let left = parsePrimary();
                while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
                    let op = tokens[pos++];
                    let right = parsePrimary();
                    if (op === '*') left *= right;
                    if (op === '/') left /= right;
                }
                return left;
            }

            function parseExpression() {
                let left = parseMultiplicative();
                while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
                    let op = tokens[pos++];
                    let right = parseMultiplicative();
                    if (op === '+') left += right;
                    if (op === '-') left -= right;
                }
                return left;
            }

            return parseExpression();
        } catch (e) {
            return null;
        }
    }
};

window.MathParser = MathParser;
