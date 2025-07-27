import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../context/user.context';
import axios from "../config/axios";
import { useNavigate } from 'react-router-dom';
import { 
    FiPlus, 
    FiUsers, 
    FiFolder, 
    FiLoader, 
    FiAlertCircle, 
    FiX, 
    FiChevronRight, 
    FiLogOut, 
    FiTrash2, 
    FiMoreVertical, 
    FiEdit2,
    FiUser
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Transition } from '@headlessui/react';
import { toast } from 'react-toastify';

const Home = () => {
    const navigate = useNavigate();
    const { user, logout, shouldRedirect } = useUser();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deletingProjectId, setDeletingProjectId] = useState(null);

    // Handle logout with navigation
    const handleLogout = useCallback(() => {
        logout(navigate);
    }, [logout, navigate]);

    // Handle redirect if needed
    useEffect(() => {
        if (shouldRedirect) {
            navigate('/login');
        }
    }, [shouldRedirect, navigate]);

    const createProject = async (e) => {
        e.preventDefault();
        if (!projectName.trim()) {
            setError('Project name cannot be empty');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const res = await axios.post('/projects/create', {
                name: projectName.trim(),
            });
            
            setProjects(prev => [res.data.project, ...prev]);
            setProjectName('');
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error creating project:', error);
            setError(error.response?.data?.message || 'Failed to create project');
        } finally {
            setIsCreating(false);
        }
    };

    const fetchProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const res = await axios.get('/projects/all');
            setProjects(res.data.projects || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
            setError('Failed to load projects. Please try again.');
            
            // If unauthorized, redirect to login
            if (error.response?.status === 401) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    const handleDeleteProject = async (projectId, e) => {
        e?.stopPropagation();
        
        // Show a more user-friendly confirmation dialog
        const confirmed = window.confirm('Are you sure you want to delete this project? This action cannot be undone.');
        if (!confirmed) {
            return;
        }

        console.log('Attempting to delete project with ID:', projectId);
        setDeletingProjectId(projectId);
        
        try {
            // Show a loading toast
            const toastId = toast.loading('Deleting project...');
            
            try {
                // Call the delete endpoint with error logging
                console.log('Sending DELETE request to:', `/projects/${projectId}`);
                const response = await axios.delete(`/projects/${projectId}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                console.log('Delete response:', response);
                
                if (response.data && response.data.success) {
                    // Update the projects list
                    setProjects(prev => {
                        const updated = prev.filter(p => p._id !== projectId);
                        console.log('Updated projects list:', updated);
                        return updated;
                    });
                    
                    // Show success message
                    toast.update(toastId, {
                        render: response.data.message || 'Project deleted successfully',
                        type: 'success',
                        isLoading: false,
                        autoClose: 3000
                    });
                } else {
                    throw new Error(response.data?.error || 'Failed to delete project: No success response');
                }
            } catch (apiError) {
                console.error('API Error details:', {
                    message: apiError.message,
                    response: apiError.response,
                    request: apiError.request,
                    config: apiError.config
                });
                throw apiError; // Re-throw to be caught by outer catch
            }
        } catch (error) {
            console.error('Error in handleDeleteProject:', {
                error,
                errorString: String(error),
                errorStack: error.stack,
                projectId
            });
            
            // Show error message
            const errorMessage = error.response?.data?.error || 
                               error.message || 
                               'Failed to delete project. Please check the console for details.';
            
            toast.error(errorMessage, {
                position: 'top-right',
                autoClose: 7000, // Longer display for errors
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true
            });
            
            if (error.response?.status === 401) {
                console.log('Authentication error, logging out...');
                logout();
            }
        } finally {
            setDeletingProjectId(null);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    // Animation variants for Framer Motion
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white">My Projects</h1>
                            <div className="h-8 w-px bg-gray-700"></div>
                            <div className="flex items-center text-sm text-gray-400">
                                <FiUser className="mr-1.5 h-4 w-4" />
                                <span>{user?.email || 'User'}</span>
                            </div>
                        </div>
                        <p className="text-gray-400 mt-1">Create and manage your coding projects</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-purple-500/20"
                        >
                            <FiPlus className="h-5 w-5" />
                            <span className="hidden sm:inline">New Project</span>
                        </button>
                        
                        {/* Enhanced Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-red-500/20 whitespace-nowrap"
                        >
                            <FiLogOut className="h-5 w-5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                        
                        {/* Keep the menu for mobile */}
                        <Menu as="div" className="relative sm:hidden">
                            <Menu.Button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                <FiMoreVertical className="h-5 w-5" />
                            </Menu.Button>
                            <Transition
                                as={React.Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-800 border border-gray-700 rounded-lg shadow-lg focus:outline-none z-10">
                                    <div className="p-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLogout();
                                                    }}
                                                    className={`${
                                                        active ? 'bg-red-500/10 text-red-400' : 'text-red-400'
                                                    } group flex w-full items-center rounded-md px-4 py-2 text-sm sm:hidden`}
                                                >
                                                    <FiLogOut className="mr-3 h-5 w-5" />
                                                    Sign Out
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </header>

                {/* Error Message */}
                {error && !isLoading && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
                        <FiAlertCircle className="h-5 w-5 flex-shrink-0" />
                        <span>{error}</span>
                        <button 
                            onClick={() => setError(null)}
                            className="ml-auto opacity-70 hover:opacity-100"
                        >
                            <FiX className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <FiLoader className="h-8 w-8 text-purple-400 animate-spin" />
                        <span className="ml-3 text-gray-400">Loading projects...</span>
                    </div>
                ) : (
                    /* Projects Grid */
                    <motion.div 
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                    >
                        {/* New Project Card */}
                        <motion.div 
                            variants={item}
                            onClick={() => setIsModalOpen(true)}
                            className="group relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl bg-gray-800/50 hover:bg-gray-800/70 transition-all duration-200 cursor-pointer h-full min-h-[180px]"
                        >
                            <div className="p-3 rounded-full bg-gray-700 group-hover:bg-purple-500/20 transition-colors duration-200 mb-3">
                                <FiPlus className="h-8 w-8 text-purple-400 group-hover:text-purple-300" />
                            </div>
                            <h3 className="text-lg font-medium text-white">New Project</h3>
                            <p className="text-sm text-gray-400 text-center mt-1">Start a new coding project</p>
                        </motion.div>

                        {/* Project Cards */}
                        {projects.map((project) => (
                            <motion.div
                                key={project._id}
                                variants={item}
                                onClick={() => navigate(`/project`, { state: { project } })}
                                className="group relative p-5 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500/50 transition-all duration-200 cursor-pointer overflow-hidden h-full flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                        <FiFolder className="h-5 w-5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                                            {project.files?.length || 0} {project.files?.length === 1 ? 'file' : 'files'}
                                        </span>
                                        
                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project._id, e);
                                            }}
                                            disabled={deletingProjectId === project._id}
                                            className={`p-1.5 rounded-full ${
                                                deletingProjectId === project._id 
                                                    ? 'text-red-400 cursor-wait' 
                                                    : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                                            } transition-colors`}
                                            title="Delete project"
                                        >
                                            {deletingProjectId === project._id ? (
                                                <FiLoader className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <FiTrash2 className="h-4 w-4" />
                                            )}
                                        </button>
                                        
                                        {/* Options Menu */}
                                        <Menu as="div" className="relative">
                                            <Menu.Button 
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                            >
                                                <FiMoreVertical className="h-4 w-4" />
                                            </Menu.Button>
                                            <Transition
                                                as={React.Fragment}
                                                enter="transition ease-out duration-100"
                                                enterFrom="transform opacity-0 scale-95"
                                                enterTo="transform opacity-100 scale-100"
                                                leave="transition ease-in duration-75"
                                                leaveFrom="transform opacity-100 scale-100"
                                                leaveTo="transform opacity-0 scale-95"
                                            >
                                                <Menu.Items className="absolute right-0 mt-1 w-40 origin-top-right bg-gray-800 border border-gray-700 rounded-lg shadow-lg focus:outline-none z-10">
                                                    <div className="p-1">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={(e) => handleDeleteProject(project._id, e)}
                                                                    disabled={deletingProjectId === project._id}
                                                                    className={`${
                                                                        active ? 'bg-red-500/10 text-red-400' : 'text-red-400'
                                                                    } group flex w-full items-center rounded-md px-4 py-2 text-sm disabled:opacity-50`}
                                                                >
                                                                    {deletingProjectId === project._id ? (
                                                                        <FiLoader className="mr-3 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <FiTrash2 className="mr-3 h-4 w-4" />
                                                                    )}
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>
                                    </div>
                                </div>
                                
                                <h3 className="text-lg font-medium text-white mb-1 line-clamp-1">
                                    {project.name}
                                </h3>
                                
                                <div className="mt-auto pt-4 flex items-center justify-between">
                                    <div className="flex items-center text-sm text-gray-400">
                                        <FiUsers className="h-4 w-4 mr-1.5" />
                                        <span>{project.users?.length || 1} {project.users?.length === 1 ? 'member' : 'members'}</span>
                                    </div>
                                    <div className="text-purple-400 group-hover:translate-x-1 transition-transform duration-200">
                                        <FiChevronRight className="h-5 w-5" />
                                    </div>
                                </div>
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-4">
                                    <span className="text-sm text-white font-medium">Open Project</span>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* Empty State */}
                {!isLoading && projects.length === 0 && (
                    <div className="text-center py-16">
                        <div className="mx-auto h-24 w-24 text-gray-600">
                            <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-200">No projects yet</h3>
                        <p className="mt-1 text-gray-400">Get started by creating a new project.</p>
                        <div className="mt-6">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                            >
                                <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                                New Project
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50">
                {toast(
                    <div className="p-4 bg-gray-800 text-white rounded-lg shadow-lg border border-gray-700">
                        {toast.message}
                    </div>,
                    {
                        position: "bottom-right",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    }
                )}
            </div>

            {/* Create Project Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
                    >
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            className="bg-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-700"
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-xl font-bold text-white">Create New Project</h2>
                                    <button 
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"
                                    >
                                        <FiX className="h-5 w-5" />
                                    </button>
                                </div>
                                
                                <form onSubmit={createProject}>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-1">
                                                Project Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                id="projectName"
                                                type="text"
                                                value={projectName}
                                                onChange={(e) => setProjectName(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-200"
                                                placeholder="My Awesome Project"
                                                autoFocus
                                                required
                                            />
                                            {error && (
                                                <p className="mt-1 text-sm text-red-400">{error}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-4 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200"
                                            disabled={isCreating}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isCreating || !projectName.trim()}
                                            className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all duration-200 flex items-center ${
                                                isCreating || !projectName.trim()
                                                    ? 'bg-purple-500/50 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-purple-500/20'
                                            }`}
                                        >
                                            {isCreating ? (
                                                <>
                                                    <FiLoader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                                    Creating...
                                                </>
                                            ) : (
                                                'Create Project'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Home;