export const computeFirst = (symbol, grammar, memo = new Map(), visitedSet = new Set()) => {
    if (visitedSet.has(symbol)) return new Set();
    if (memo.has(symbol)) return memo.get(symbol);
    const first = new Set();
    
    visitedSet.add(symbol);

    if (!grammar[symbol]) {
        first.add(symbol);
        return first;
    }

    grammar[symbol].forEach(production => {
        if (production.length === 0 || production[0] === '') {
            first.add('');
        } else {
            const firstSymbol = production[0];
            const firstSet = computeFirst(firstSymbol, grammar, memo, visitedSet);
            firstSet.forEach(s => first.add(s));
        }
    });

    visitedSet.delete(symbol);
    memo.set(symbol, first);
    return first;
};

export const parseProductionRules = (input) => {
    if (!input.trim()) throw new Error("Input cannot be empty.");

    const lines = input.trim().split('\n');
    const parsedRules = [];
    const grammar = {};
    
    const firstLHS = lines[0].split('->')[0].trim();
    const startSymbol = firstLHS;
    
    lines.forEach(line => {
        const parts = line.split('->');
        const lhs = parts[0].trim();
        const rhs = parts[1] ? parts[1].trim() : '';

        if (!grammar[lhs]) grammar[lhs] = [];

        if (!rhs) {
            grammar[lhs].push(['ε']);
            parsedRules.push({
                nonTerminal: lhs,
                productions: [['ε']]
            });
        } else {
            const productions = rhs.split('|').map(prod => prod.trim().split(/\s+/));
            productions.forEach(prod => {
                grammar[lhs].push(prod);
                parsedRules.push({
                    nonTerminal: lhs,
                    productions: [prod]
                });
            });
        }
    });

    return { parsedRules, grammar, startSymbol };
};

export const computeLR1Items = (grammar, startSymbol) => {
    const computeFirstForString = (string, grammar) => {
        if (string.length === 0) return new Set(['']);
        const firstSet = new Set();
        const firstSymbolFirst = computeFirst(string[0], grammar);
        firstSymbolFirst.forEach(symbol => {
            if (symbol === '') {
                if (string.length > 1) {
                    const restFirst = computeFirstForString(string.slice(1), grammar);
                    restFirst.forEach(s => firstSet.add(s));
                } else {
                    firstSet.add('');
                }
            } else {
                firstSet.add(symbol);
            }
        });
        return firstSet;
    };

    const closureLR1 = (items, grammar) => {
        const result = [...items];
        let changed = true;
    
        while (changed) {
            changed = false;
            const itemsToAdd = [];
    
            for (let i = 0; i < result.length; i++) {
                const item = result[i];
                const dotIndex = item.itemWithDot.indexOf('.');
                if (dotIndex < item.itemWithDot.length - 1) {
                    const nextSymbol = item.itemWithDot[dotIndex + 1];
                    if (grammar[nextSymbol]) {
                        const beta = item.itemWithDot.slice(dotIndex + 2);
                        const lookaheadFirst = computeFirstForString([...beta, item.lookahead], grammar);
    
                        grammar[nextSymbol].forEach(production => {
                            lookaheadFirst.forEach(lookahead => {
                                const newItem = {
                                    nonTerminal: nextSymbol,
                                    production,
                                    itemWithDot: ['.', ...production],
                                    lookahead
                                };
                                
                                if (!result.some(existingItem => 
                                    JSON.stringify(existingItem) === JSON.stringify(newItem)) &&
                                    !itemsToAdd.some(existingItem =>
                                        JSON.stringify(existingItem) === JSON.stringify(newItem))) {
                                    itemsToAdd.push(newItem);
                                }
                            });
                        });
                    }
                }
            }
    
            if (itemsToAdd.length > 0) {
                result.push(...itemsToAdd);
                changed = true;
            }
        }
        return result;
    };

    const gotoLR1 = (items, symbol, grammar) => {
        const nextItems = items
            .filter(item => {
                const dotIndex = item.itemWithDot.indexOf('.');
                return dotIndex < item.itemWithDot.length - 1 && 
                       item.itemWithDot[dotIndex + 1] === symbol;
            })
            .map(item => {
                const newDot = [...item.itemWithDot];
                const dotIndex = newDot.indexOf('.');
                [newDot[dotIndex], newDot[dotIndex + 1]] = [newDot[dotIndex + 1], newDot[dotIndex]];
                return { ...item, itemWithDot: newDot };
            });

        return closureLR1(nextItems, grammar);
    };

    const canonicalCollection = (initialItem, grammar) => {
        const states = new Map();
        const initial = closureLR1([initialItem], grammar);
        const queue = [initial];
        const processedStates = new Set();

        while (queue.length > 0) {
            const currentState = queue.shift();
            const stateKey = JSON.stringify(currentState);
            
            if (processedStates.has(stateKey)) continue;
            processedStates.add(stateKey);

            const symbolsAfterDot = new Set();
            currentState.forEach(item => {
                const dotIndex = item.itemWithDot.indexOf('.');
                if (dotIndex < item.itemWithDot.length - 1) {
                    symbolsAfterDot.add(item.itemWithDot[dotIndex + 1]);
                }
            });

            const transitions = {};
            symbolsAfterDot.forEach(symbol => {
                const nextState = gotoLR1(currentState, symbol, grammar);
                if (nextState.length > 0) {
                    transitions[symbol] = nextState;
                    const nextStateKey = JSON.stringify(nextState);
                    if (!processedStates.has(nextStateKey)) {
                        queue.push(nextState);
                    }
                }
            });

            states.set(states.size, { items: currentState, transitions });
        }

        return Array.from(states.values());
    };

    const augmentedStartSymbol = `${startSymbol}'`;
    const initialItem = {
        nonTerminal: augmentedStartSymbol,
        production: [startSymbol],
        itemWithDot: ['.', startSymbol],
        lookahead: '$'
    };

    return canonicalCollection(initialItem, grammar);
};

export const extractSymbols = (parsedRules) => {
    const nonTerminals = new Set();
    const terminals = new Set();
    
    parsedRules.forEach(rule => {
        nonTerminals.add(rule.nonTerminal);
    });

    parsedRules.forEach(rule => {
        rule.productions[0].forEach(symbol => {
            if (!nonTerminals.has(symbol)) {
                terminals.add(symbol);
            }
        });
    });
    
    return {
        terminals: Array.from(terminals),
        nonTerminals: Array.from(nonTerminals)
    };
};

export const findProductionIndex = (item, grammar) => {
    let index = 0;
    for (const [nonTerminal, productions] of Object.entries(grammar)) {
        for (const production of productions) {
            if (nonTerminal === item.nonTerminal && 
                JSON.stringify(production) === JSON.stringify(item.production)) {
                return index;
            }
            index++;
        }
    }
    return -1;
};

export const findStateIndex = (states, targetState) => {
    if (!targetState) return -1;
    return states.findIndex(state => 
        JSON.stringify(state.items) === JSON.stringify(targetState)
    );
};

export const createLR1ParseTable = (states, terminals, nonTerminals, grammar, startSymbol) => {
    const ACTION = {};
    const GOTO = {};
    
    states.forEach((_, i) => {
        ACTION[i] = {};
        GOTO[i] = {};
        terminals.forEach(t => ACTION[i][t] = '');
        ACTION[i]['$'] = '';
        nonTerminals.forEach(nt => GOTO[i][nt] = '');
    });

    states.forEach((state, i) => {
        state.items.forEach(item => {
            const dotIndex = item.itemWithDot.indexOf('.');
            
            if (dotIndex === item.itemWithDot.length - 1) {
                if (item.nonTerminal === `${startSymbol}'` && 
                    item.production[0] === startSymbol && 
                    item.lookahead === '$') {
                    ACTION[i]['$'] = 'acc';
                } else {
                    ACTION[i][item.lookahead] = `r${findProductionIndex(item, grammar)}`;
                }
            } else {
                const symbol = item.itemWithDot[dotIndex + 1];
                if (terminals.includes(symbol)) {
                    const nextState = findStateIndex(states, state.transitions[symbol]);
                    if (nextState !== -1) {
                        ACTION[i][symbol] = `s${nextState}`;
                    }
                } else if (nonTerminals.includes(symbol)) {
                    const nextState = findStateIndex(states, state.transitions[symbol]);
                    if (nextState !== -1) {
                        GOTO[i][symbol] = nextState;
                    }
                }
            }
        });
    });

    

    return {
        ACTION,
        GOTO,
        columns: [...terminals, '$', ...nonTerminals],
        rows: states.map((_, i) => {
            return [...terminals, '$'].map(t => ACTION[i][t])
                .concat(nonTerminals.map(nt => GOTO[i][nt] || ''));
        })
    };
};