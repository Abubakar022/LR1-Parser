import React, { useState } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    MarkerType,
    useNodesState,
    useEdgesState 
} from 'reactflow';
import { computeLR1Items, createLR1ParseTable, extractSymbols, parseProductionRules } from './Grammar';
import 'reactflow/dist/style.css';

const prepareFlowData = (states) => {
    const nodes = states.map((state, index) => ({
        id: `state${index}`,
        type: 'default',
        data: {
            label: (
                <div className="text-xs">
                    <div className="font-bold border-b border-gray-300 pb-1 mb-1">
                        State {index}
                    </div>
                    <div className="text-left">
                        {state.items.map((item, i) => (
                            <div key={i} className="whitespace-nowrap">
                                {`${item.nonTerminal} → ${item.itemWithDot.join(' ')} , ${item.lookahead}`}
                            </div>
                        ))}
                    </div>
                </div>
            ),
            items: state.items
        },
        position: {
            x: Math.cos(index * 2 * Math.PI / states.length) * 500 + 500,
            y: Math.sin(index * 2 * Math.PI / states.length) * 200 + 300,
        },
        style: {
            background: "#fff",
            border: '2px solid #4da6ff',
            borderRadius: '8px',
            padding: '10px',
            width: 'auto',
            minWidth: 200,
            fontSize: '11px',
            fontFamily: 'monospace'
        }
    }));

    const edges = [];
    states.forEach((state, fromIndex) => {
        Object.entries(state.transitions).forEach(([symbol, targetState]) => {
            const toIndex = states.findIndex(s => 
                JSON.stringify(s.items) === JSON.stringify(targetState)
            );
            if (toIndex !== -1) {
                edges.push({
                    id: `edge-${fromIndex}-${toIndex}`,
                    source: `state${fromIndex}`,
                    target: `state${toIndex}`,
                    label: symbol,
                    type: 'smoothstep',
                    markerEnd: {
                        type: MarkerType.Arrow
                    },
                    style: {
                        stroke: '#80ffdf'
                    }
                });
            }
        });
    });

    return { nodes, edges };
};


export default function LR1App() {
  const [input, setInput] = useState('');
  const [tableData, setTableData] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [activeTab, setActiveTab] = useState('diagram');


  const handleParse = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      const { parsedRules, grammar, startSymbol } = parseProductionRules(input);
      const states = computeLR1Items(grammar, startSymbol);
      const { terminals, nonTerminals } = extractSymbols(parsedRules);
      const table = createLR1ParseTable(states, terminals, nonTerminals, grammar, startSymbol);
      
      setTableData(table);
      const { nodes, edges } = prepareFlowData(states);
      setNodes(nodes);
      setEdges(edges);
    } catch (err) {
      setError(err.message);
      setTableData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg shadow-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-600">
            LR(1) Parser
          </h1>
          <button
            onClick={handleParse}
            disabled={isProcessing || !input.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-teal-600 text-white hover:from-blue-700 hover:to-teal-700"
          >
            {isProcessing ? 'Processing...' : 'Generate Parser'}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-4 py-2 rounded ${activeTab === 'diagram' ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              State Diagram
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`px-4 py-2 rounded ${activeTab === 'table' ? 'bg-blue-600 text-white' : 'bg-white'}`}
            >
              Parse Table
            </button>
          </div>

          {activeTab === 'diagram' ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="h-[70vh]">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          ) : tableData ? (
            <div className="bg-white rounded-xl shadow-lg">
              <div className="p-4 border-b">
                <h2 className="text-lg font-medium">Parsing Table</h2>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-200">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 px-4 py-2 text-left text-sm font-medium bg-gray-50">
                          State
                        </th>
                        {tableData.columns.map((col, i) => (
                          <th key={i} className="border border-gray-200 px-4 py-2 text-left text-sm font-medium bg-gray-50">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="border border-gray-200 px-4 py-2 text-sm font-medium">
                            {i}
                          </td>
                          {row.map((cell, j) => (
                            <td key={j} className="border border-gray-200 px-4 py-2 text-sm">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
              No parsing table generated yet. Enter grammar rules and click "Generate Parser".
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grammar Rules
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter grammar rules (e.g., E -> E + T | T)"
              className="w-full h-64 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}