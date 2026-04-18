(function () {
    let activeSuggestion = null;
    let suggestionElement = null;

    function getActiveLineTextUpToCursor() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return '';
        
        const range = selection.getRangeAt(0);
        const activeLine = document.querySelector('.cm-activeLine');
        if (!activeLine) {
            const selectionNode = range.startContainer.closest ? range.startContainer.closest('.cm-line') : range.startContainer.parentElement.closest('.cm-line');
            if (!selectionNode) return '';
            return getTextUpToRange(selectionNode, range);
        }
        
        if (!activeLine.contains(range.startContainer)) return '';
        return getTextUpToRange(activeLine, range);
    }

    function getTextUpToRange(root, range) {
        const textBeforeCursor = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        
        let node;
        while (node = walker.nextNode()) {
            if (node === range.startContainer) {
                textBeforeCursor.push(node.textContent.substring(0, range.startOffset));
                break;
            }
            textBeforeCursor.push(node.textContent);
        }
        
        return textBeforeCursor.join('').replace(/[\u200B-\u200D\uFEFF]/g, '');
    }

    function getCursorCoordinates() {
        let cursor = document.querySelector('.cm-cursor-primary');
        if (!cursor) {
            cursor = document.querySelector('.cm-cursor');
        }
        
        if (cursor) {
            return cursor.getBoundingClientRect();
        }

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            if (rects.length > 0) {
                return rects[0];
            }
        }
        return null;
    }

    function getActiveLineTextAfterCursor() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return '';
        
        const range = selection.getRangeAt(0);
        const activeLine = document.querySelector('.cm-activeLine');
        if (!activeLine || !activeLine.contains(range.startContainer)) return '';

        const textAfterCursor = [];
        const walker = document.createTreeWalker(activeLine, NodeFilter.SHOW_TEXT, null, false);
        
        let foundCursor = false;
        let node;
        while (node = walker.nextNode()) {
            if (node === range.startContainer) {
                textAfterCursor.push(node.textContent.substring(range.startOffset));
                foundCursor = true;
                continue;
            }
            if (foundCursor) {
                textAfterCursor.push(node.textContent);
            }
        }
        
        return textAfterCursor.join('').replace(/[\u200B-\u200D\uFEFF]/g, '');
    }

    function showSuggestion(text, coords) {
        removeSuggestion();

        const textBefore = getActiveLineTextUpToCursor();
        const textAfter = getActiveLineTextAfterCursor();
        const inMathBlock = textBefore.includes('$');
        const hasTrailingDollar = textAfter.trim().startsWith('$');

        let displaySuffix = '';
        if (inMathBlock) {
            displaySuffix = '$';
        }

        suggestionElement = document.createElement('div');
        suggestionElement.className = 'overleaf-autocomplete-suggestion';
        suggestionElement.innerText = text + displaySuffix;
        
        const activeLine = document.querySelector('.cm-activeLine');
        if (activeLine) {
            const styles = window.getComputedStyle(activeLine);
            suggestionElement.style.lineHeight = styles.lineHeight;
            suggestionElement.style.fontSize = styles.fontSize;
            suggestionElement.style.fontFamily = styles.fontFamily;
            suggestionElement.style.backgroundColor = styles.backgroundColor || 'white';
            if (suggestionElement.style.backgroundColor === 'rgba(0, 0, 0, 0)') {
                suggestionElement.style.backgroundColor = 'white';
            }
        }

        const coords_now = getCursorCoordinates() || coords;
        if (coords_now) {
            suggestionElement.style.top = `${coords_now.top + window.scrollY}px`;
            suggestionElement.style.left = `${coords_now.left + window.scrollX + 5}px`;
            document.body.appendChild(suggestionElement);
            activeSuggestion = text;
        }
    }

    function removeSuggestion() {
        if (suggestionElement) {
            suggestionElement.remove();
            suggestionElement = null;
        }
        activeSuggestion = null;
    }

    function handleInput() {
        setTimeout(() => {
            const text = getActiveLineTextUpToCursor();
            const coords = getCursorCoordinates();
            
            if (!text) {
                removeSuggestion();
                return;
            }

            const match = text.match(/([^=]+)=\s*$/);
            if (match) {
                const parts = text.split('=');
                const exprCandidate = parts[parts.length - 2];
                
                if (exprCandidate && window.MathParser) {
                    const result = window.MathParser.evaluate(exprCandidate);
                    if (result !== null) {
                        showSuggestion(String(result), coords);
                        return;
                    }
                }
            }
            removeSuggestion();
        }, 50);
    }

    function onKeyDown(e) {
        if (activeSuggestion) {
            if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand('insertText', false, activeSuggestion);
                removeSuggestion();
            } else if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
                removeSuggestion();
            }
        }
    }

    function init() {
        const editor = document.querySelector('.cm-content');
        if (editor) {
            editor.addEventListener('input', handleInput);
            editor.addEventListener('keydown', onKeyDown, true);
            editor.addEventListener('blur', removeSuggestion);
            window.addEventListener('mousedown', removeSuggestion);
        } else {
            setTimeout(init, 1000);
        }
    }

    init();

    const observer = new MutationObserver(() => {
        const editor = document.querySelector('.cm-content');
        if (editor && !editor.dataset.autocompleteBound) {
            editor.dataset.autocompleteBound = 'true';
            editor.addEventListener('input', handleInput);
            editor.addEventListener('keydown', onKeyDown, true);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
