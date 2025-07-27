import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';

export const createProject = async ({
    name, userId
}) => {
    if (!name) {
        throw new Error('Name is required')
    }
    if (!userId) {
        throw new Error('UserId is required')
    }

    let project;
    try {
        project = await projectModel.create({
            name,
            users: [ userId ]
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Project name already exists');
        }
        throw error;
    }

    return project;

}


export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new Error('UserId is required')
    }

    const allUserProjects = await projectModel.find({
        users: userId
    })

    return allUserProjects
}

export const addUsersToProject = async ({ projectId, users, userId }) => {

    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId")
    }

    if (!users) {
        throw new Error("users are required")
    }

    if (!Array.isArray(users) || users.some(userId => !mongoose.Types.ObjectId.isValid(userId))) {
        throw new Error("Invalid userId(s) in users array")
    }

    if (!userId) {
        throw new Error("userId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid userId")
    }


    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    })

    console.log(project)

    if (!project) {
        throw new Error("User not belong to this project")
    }

    const updatedProject = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        $addToSet: {
            users: {
                $each: users
            }
        }
    }, {
        new: true
    })

    return updatedProject



}

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId")
    }

    const project = await projectModel.findOne({
        _id: projectId
    }).populate('users')

    return project;
}

export const updateFileTree = async ({ projectId, fileTree }) => {
    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!fileTree) {
        throw new Error("fileTree is required")
    }

    const updatedProject = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        fileTree
    }, {
        new: true
    })

    if (!updatedProject) {
        throw new Error("Project not found")
    }

    return updatedProject
}

export const deleteProject = async ({ projectId, userId }) => {
    console.log('deleteProject service called with:', { projectId, userId });
    
    if (!projectId) {
        console.error('No projectId provided to deleteProject');
        throw new Error("projectId is required");
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        console.error('Invalid projectId format:', projectId);
        throw new Error("Invalid projectId");
    }

    if (!userId) {
        console.error('No userId provided to deleteProject');
        throw new Error("userId is required");
    }

    console.log('Searching for project with ID:', projectId, 'and user ID:', userId);
    
    // Find the project and verify the user has permission to delete it
    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    });

    console.log('Project found:', project ? 'Yes' : 'No');

    if (!project) {
        // Try to find if project exists but user doesn't have access
        const projectExists = await projectModel.exists({ _id: projectId });
        console.log('Project exists but user may not have access. Project exists:', projectExists);
        
        throw new Error("Project not found or you don't have permission to delete it");
    }

    console.log('Attempting to delete project with ID:', projectId);
    
    try {
        // Delete the project
        const result = await projectModel.findByIdAndDelete(projectId);
        console.log('Delete operation result:', result);
        
        if (!result) {
            console.error('Failed to delete project - no document was deleted');
            throw new Error('Failed to delete project - no document was deleted');
        }
        
        console.log('Successfully deleted project:', projectId);
        return { 
            success: true, 
            message: "Project deleted successfully",
            deletedCount: 1
        };
    } catch (error) {
        console.error('Error in project deletion:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error; // Re-throw to be handled by the controller
    }
}