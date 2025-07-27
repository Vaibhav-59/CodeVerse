import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer';

// Syntax highlighting component for code blocks
function SyntaxHighlightedCode(props) {
    const ref = useRef(null);

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current);
            ref.current.removeAttribute('data-highlighted');
        }
    }, [props.className, props.children]);

    return <code {...props} ref={ref} />;
}

const Project = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);
    const messageBox = useRef(null);

    // State management
    const [project, setProject] = useState(location.state?.project || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // UI State
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeView, setActiveView] = useState('chat'); // 'chat' or 'code'
    const isMobile = window.innerWidth <= 768;

    // Chat functionality
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);

    // Collaboration
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(new Set());

    // Code editor functionality
    const [fileTree, setFileTree] = useState({});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);

    // WebContainer functionality
    const [webContainer, setWebContainer] = useState(null);
    const [iframeUrl, setIframeUrl] = useState(null);
    const [runProcess, setRunProcess] = useState(null);
    const [isRunning, setIsRunning] = useState(false);

    // Initialize project and socket connection
    useEffect(() => {
        if (!project) {
            setError('No project data found');
            setLoading(false);
            return;
        }

        const initializeProject = async () => {
            try {
                setLoading(true);

                // Initialize socket connection
                initializeSocket(project._id);

                // Initialize WebContainer
                if (!webContainer) {
                    const container = await getWebContainer();
                    setWebContainer(container);
                }

                // Set up message listener
                receiveMessage('project-message', (data) => {
                    if (data.sender._id === 'ai') {
                        // Use the robust safeJsonParse function instead of basic JSON.parse
                        const parseResult = safeJsonParse(data.message);

                        if (parseResult.success) {
                            const aiMessage = parseResult.data;
                            if (aiMessage.fileTree && typeof aiMessage.fileTree === 'object') {
                                webContainer?.mount(aiMessage.fileTree);
                                setFileTree(aiMessage.fileTree);
                            }
                            // Update the data with the successfully parsed message
                            const updatedData = {
                                ...data,
                                message: JSON.stringify(aiMessage)
                            };
                            setMessages(prev => [...prev, updatedData]);
                        } else {
                            console.error('Error parsing AI message:', parseResult.error);
                            console.error('Original message:', data.message);
                            // Still add the message to display, but mark it as unparseable
                            const errorData = {
                                ...data,
                                message: JSON.stringify({
                                    text: "Error: Could not parse AI response. Raw message: " + data.message.substring(0, 200) + "...",
                                    error: true,
                                    parseError: parseResult.error
                                })
                            };
                            setMessages(prev => [...prev, errorData]);
                        }
                    } else {
                        setMessages(prev => [...prev, data]);
                    }
                });

                // Fetch project data
                const projectRes = await axios.get(`/projects/get-project/${project._id}`);
                setProject(projectRes.data.project);
                setFileTree(projectRes.data.project.fileTree || {});

                // Fetch users for collaboration
                const usersRes = await axios.get('/users/all');
                setUsers(usersRes.data.users);

                setLoading(false);
            } catch (err) {
                console.error('Error initializing project:', err);
                setError('Failed to load project');
                setLoading(false);
            }
        };

        initializeProject();
    }, [project?._id]);

    // Auto-scroll messages
    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }, [messages]);

    // Handle user selection for collaboration
    const handleUserClick = (id) => {
        setSelectedUserId(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Add collaborators to project
    const addCollaborators = async () => {
        if (!project || selectedUserId.size === 0) return;

        try {
            await axios.put('/projects/add-user', {
                projectId: project._id,
                users: Array.from(selectedUserId)
            });
            setIsModalOpen(false);
            setSelectedUserId(new Set());
        } catch (err) {
            console.error('Error adding collaborators:', err);
        }
    };

    // Send message
    const handleSendMessage = () => {
        console.log('Attempting to send message...');
        if (!message.trim() || !project || !user) {
            console.error('Cannot send message. Missing message, project, or user data.', { message, project, user });
            return;
        }

        const cleanUser = {
            _id: user._id,
            email: user.email,
            name: user.name || user.email
        };

        const messageData = {
            message: message.trim(),
            sender: cleanUser
        };

        // Add message to local state immediately so sender can see it
        setMessages(prev => [...prev, { ...messageData, sender: messageData.sender }]);

        // Send message via socket to other users
        console.log('Sending message data:', messageData);
        sendMessage('project-message', messageData);

        // Clear input field
        setMessage("");
        console.log('Message sent to socket and added to local state.');
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Save file tree to backend
    const saveFileTree = async (ft) => {
        if (!project) return;

        try {
            await axios.put('/projects/update-file-tree', {
                projectId: project._id,
                fileTree: ft
            });
        } catch (err) {
            console.error('Error saving file tree:', err);
        }
    };

    // Handle file content changes
    const handleFileChange = (fileName, newContent) => {
        const updatedTree = {
            ...fileTree,
            [fileName]: {
                file: {
                    contents: newContent
                }
            }
        };
        setFileTree(updatedTree);
        saveFileTree(updatedTree);
    };

    // Run project
    const runProject = async () => {
        if (!webContainer || isRunning) return;

        try {
            setIsRunning(true);

            // Mount file tree
            await webContainer.mount(fileTree);

            // Install dependencies
            const installProcess = await webContainer.spawn('npm', ['install']);
            installProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    console.log('Install:', chunk);
                }
            }));

            // Kill existing process
            if (runProcess) {
                runProcess.kill();
            }

            // Start new process
            const newProcess = await webContainer.spawn('npm', ['start']);
            newProcess.output.pipeTo(new WritableStream({
                write(chunk) {
                    console.log('Run:', chunk);
                }
            }));

            setRunProcess(newProcess);

            // Listen for server ready
            webContainer.on('server-ready', (port, url) => {
                setIframeUrl(url);
            });

        } catch (err) {
            console.error('Error running project:', err);
        } finally {
            setIsRunning(false);
        }
    };

    // Safe JSON parser with multiple fallback strategies
    const safeJsonParse = (jsonString) => {
        if (typeof jsonString !== 'string') {
            return { success: false, error: 'Input is not a string', data: null };
        }

        // Strategy 1: Direct JSON parse
        try {
            const result = JSON.parse(jsonString);
            return { success: true, data: result, error: null };
        } catch (err) {
            console.log('Direct JSON parse failed, trying fallback strategies...');
        }

        // Strategy 2: Find and extract the first complete JSON object
        try {
            let braceCount = 0;
            let startIndex = -1;
            let endIndex = -1;

            for (let i = 0; i < jsonString.length; i++) {
                if (jsonString[i] === '{') {
                    if (startIndex === -1) startIndex = i;
                    braceCount++;
                } else if (jsonString[i] === '}') {
                    braceCount--;
                    if (braceCount === 0 && startIndex !== -1) {
                        endIndex = i;
                        break;
                    }
                }
            }

            if (startIndex !== -1 && endIndex !== -1) {
                const extractedJson = jsonString.substring(startIndex, endIndex + 1);
                const result = JSON.parse(extractedJson);
                return { success: true, data: result, error: null };
            }
        } catch (err) {
            console.log('JSON extraction by brace counting failed...');
        }

        // Strategy 3: Extract JSON using regex (fallback)
        try {
            const jsonMatch = jsonString.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return { success: true, data: result, error: null };
            }
        } catch (err) {
            console.log('Regex JSON extraction failed...');
        }

        // Strategy 4: Try to fix common JSON issues
        try {
            let fixedJson = jsonString
                .replace(/,\s*}/g, '}')  // Remove trailing commas
                .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')  // Quote unquoted keys
                .replace(/:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([,}])/g, ': "$1"$2');  // Quote unquoted string values

            // Try to extract just the first JSON object from the fixed string
            const firstJsonMatch = fixedJson.match(/\{[\s\S]*?\}/);
            if (firstJsonMatch) {
                const result = JSON.parse(firstJsonMatch[0]);
                return { success: true, data: result, error: null };
            }
        } catch (err) {
            console.log('JSON fixing failed...');
        }

        // Strategy 5: Extract just the text content if it looks like a simple message
        const textMatch = jsonString.match(/"text"\s*:\s*"([^"]+)"/);
        if (textMatch) {
            return {
                success: true,
                data: { text: textMatch[1] },
                error: null
            };
        }

        // Strategy 6: Try to extract any quoted text as fallback
        const anyTextMatch = jsonString.match(/"([^"]{10,})"/);
        if (anyTextMatch) {
            return {
                success: true,
                data: { text: anyTextMatch[1] },
                error: null
            };
        }

        return {
            success: false,
            error: 'All parsing strategies failed',
            data: null
        };
    };

    // AI Message component with robust error handling
    const WriteAiMessage = ({ message }) => {
        // Handle already parsed objects
        if (typeof message === 'object' && message !== null) {
            if (message.error) {
                return (
                    <div className="overflow-auto bg-red-900 text-red-100 rounded-sm p-2 border border-red-700">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="ri-error-warning-line"></i>
                            <span className="font-semibold">Parsing Error</span>
                        </div>
                        <p className="text-sm">{message.text}</p>
                    </div>
                );
            }

            return (
                <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2">
                    <Markdown
                        children={message.text || 'No content available'}
                        options={{
                            overrides: {
                                code: SyntaxHighlightedCode,
                            },
                        }}
                    />
                </div>
            );
        }

        // Handle string messages
        if (typeof message === 'string') {
            const parseResult = safeJsonParse(message);

            if (parseResult.success) {
                const messageObject = parseResult.data;

                // Check if it's an error message
                if (messageObject.error) {
                    return (
                        <div className="overflow-auto bg-red-900 text-red-100 rounded-sm p-2 border border-red-700">
                            <div className="flex items-center gap-2 mb-2">
                                <i className="ri-error-warning-line"></i>
                                <span className="font-semibold">Parsing Error</span>
                            </div>
                            <p className="text-sm">{messageObject.text}</p>
                        </div>
                    );
                }

                // Normal AI message
                return (
                    <div className="overflow-auto bg-slate-950 text-white rounded-sm p-2">
                        <Markdown
                            children={messageObject.text || 'No content available'}
                            options={{
                                overrides: {
                                    code: SyntaxHighlightedCode,
                                },
                            }}
                        />
                    </div>
                );
            } else {
                // Parsing failed - show as plain text with error indicator
                return (
                    <div className="overflow-auto bg-yellow-900 text-yellow-100 rounded-sm p-2 border border-yellow-700">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="ri-alert-line"></i>
                            <span className="font-semibold">Raw AI Response</span>
                        </div>
                        <p className="text-sm mb-2">Could not parse as JSON, displaying as plain text:</p>
                        <div className="bg-yellow-800 p-2 rounded text-xs font-mono max-h-64 overflow-auto">
                            {message.length > 1000 ? message.substring(0, 1000) + '...' : message}
                        </div>
                    </div>
                );
            }
        }

        // Fallback for unexpected message types
        return (
            <div className="overflow-auto bg-red-900 text-red-100 rounded-sm p-2 border border-red-700">
                <div className="flex items-center gap-2 mb-2">
                    <i className="ri-error-warning-line"></i>
                    <span className="font-semibold">Invalid Message Type</span>
                </div>
                <p className="text-sm">Unexpected message format: {typeof message}</p>
            </div>
        );
    };

    // Loading state
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading project...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Go Back Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <main className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden bg-gray-50">
            {/* Chat Section */}
            <section className={`flex flex-col h-full w-full lg:w-96 bg-white border-r border-gray-200 ${isMobile && activeView !== 'chat' ? 'hidden' : ''}`}>
                {/* Header */}
                <header className="flex justify-between items-center p-4 bg-gray-100 border-b border-gray-200">
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        <i className="ri-add-fill"></i>
                        <span>Add Collaborator</span>
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                        >
                            <i className="ri-group-fill"></i>
                        </button>
                        {isMobile && (
                            <button
                                onClick={() => setActiveView('code')}
                                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                            >
                                <i className="ri-code-line"></i>
                            </button>
                        )}
                    </div>
                </header>
                {/* Messages */}
                <div className="flex-grow flex flex-col overflow-hidden">
                    <div
                        ref={messageBox}
                        className="flex-grow p-4 overflow-y-auto space-y-3"
                    >
                        {user && messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.sender._id === user._id
                                    ? 'bg-blue-500 text-white'
                                    : msg.sender._id === 'ai'
                                        ? 'bg-gray-800 text-white'
                                        : 'bg-gray-200 text-gray-800'
                                    }`}>
                                    <div className="text-xs opacity-75 mb-1">
                                        {msg.sender.email || 'AI Assistant'}
                                    </div>
                                    <div className="text-sm">
                                        {msg.sender._id === 'ai' ? (
                                            <WriteAiMessage message={msg.message} />
                                        ) : (
                                            <p>{msg.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-gray-200">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={loading || !user ? "Connecting to chat..." : "Type your message..."}
                                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                disabled={loading || !user}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={loading || !user || !message.trim()}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <i className="ri-send-plane-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Collaborator Panel */}
                <div className={`absolute top-0 left-0 w-full h-full bg-white transform transition-transform z-10 ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <header className="flex justify-between items-center p-4 bg-gray-100 border-b">
                        <h2 className="text-lg font-semibold">Collaborators</h2>
                        <button
                            onClick={() => setIsSidePanelOpen(false)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                        >
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>

                    <div className="p-4 overflow-y-auto">
                        {project?.users?.map(user => (
                            <div key={user._id} className="flex items-center p-3 hover:bg-gray-50 rounded">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                                    {user.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-gray-800">{user.email}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Code Section */}
            <section className={`flex-grow flex flex-col bg-gray-800 text-white ${isMobile && activeView !== 'code' ? 'hidden' : ''}`}>
                {/* Code Header */}
                <header className="flex justify-between items-center p-2 bg-gray-900 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        {isMobile && (
                            <button
                                onClick={() => setActiveView('chat')}
                                className="p-2 hover:bg-gray-700 rounded"
                            >
                                <i className="ri-arrow-left-s-line"></i>
                            </button>
                        )}
                        <h2 className="font-semibold">Code Editor</h2>
                    </div>
                    <button
                        onClick={runProject}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                    >
                        {isRunning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <i className="ri-play-fill"></i>}
                        <span>{isRunning ? 'Running...' : 'Run'}</span>
                    </button>
                </header>

                <div className="flex flex-grow overflow-hidden">
                    {/* File Explorer */}
                    <div className="w-64 bg-gray-900 p-2 overflow-y-auto">
                        {Object.entries(fileTree).map(([name, data]) => (
                            <div key={name} className="mb-1">
                                <button
                                    onClick={() => {
                                        setCurrentFile(name);
                                        if (!openFiles.includes(name)) {
                                            setOpenFiles([...openFiles, name]);
                                        }
                                    }}
                                    className={`w-full text-left px-2 py-1 rounded ${currentFile === name ? 'bg-blue-500' : 'hover:bg-gray-700'}`}
                                >
                                    {name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Editor and Preview */}
                    <div className="flex-grow flex flex-col">
                        {/* Open File Tabs */}
                        <div className="flex bg-gray-900 border-b border-gray-700">
                            {openFiles.map(file => (
                                <div key={file} className={`flex items-center gap-2 px-3 py-2 border-r border-gray-700 ${currentFile === file ? 'bg-gray-800' : ''}`}>
                                    <button onClick={() => setCurrentFile(file)}>{file}</button>
                                    <button
                                        onClick={() => {
                                            setOpenFiles(openFiles.filter(f => f !== file));
                                            if (currentFile === file) {
                                                setCurrentFile(openFiles[0] || null);
                                            }
                                        }}
                                        className="text-xs hover:bg-gray-700 p-1 rounded"
                                    >
                                        <i className="ri-close-fill"></i>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Code Editor */}
                        {currentFile ? (
                            <div className="flex-grow bg-[#282c34] overflow-auto">
                                <textarea
                                    value={fileTree[currentFile]?.file?.contents || ''}
                                    onChange={(e) => handleFileChange(currentFile, e.target.value)}
                                    className="w-full h-full bg-transparent text-white p-4 font-mono resize-none focus:outline-none"
                                />
                            </div>
                        ) : (
                            <div className="flex-grow flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <i className="ri-file-text-line text-4xl mb-2"></i>
                                    <p>Select a file to start editing</p>
                                </div>
                            </div>
                        )}

                        {/* Preview */}
                        {iframeUrl && (
                            <div className="h-96 border-t border-gray-700">
                                <div className="flex items-center justify-between p-2 bg-gray-900">
                                    <h3 className="font-medium">Preview</h3>
                                    <input
                                        type="text"
                                        value={iframeUrl}
                                        onChange={(e) => setIframeUrl(e.target.value)}
                                        className="px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded flex-grow mx-2 focus:ring-purple-500 focus:border-purple-500"
                                        placeholder="Enter URL and press Enter"
                                    />
                                    <button
                                        onClick={() => setIframeUrl(null)}
                                        className="p-1 text-gray-300 hover:text-white hover:bg-red-500 rounded"
                                        title="Close preview"
                                    >
                                        <i className="ri-close-line"></i>
                                    </button>
                                </div>
                                <iframe
                                    src={iframeUrl}
                                    className="w-full h-full bg-white"
                                    title="Project Preview"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Add Collaborator Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 max-w-[95%]">
                        <header className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Add Collaborators</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-200 rounded">
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                            {users.map(u => (
                                <div
                                    key={u._id}
                                    onClick={() => handleUserClick(u._id)}
                                    className={`flex items-center p-2 rounded cursor-pointer ${selectedUserId.has(u._id) ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedUserId.has(u._id)}
                                        readOnly
                                        className="mr-3"
                                    />
                                    <span>{u.email}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Add to Project
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Project;