import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';


export const createProject = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const userId = loggedInUser._id;

        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json(newProject);

    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }



}

export const getAllProject = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        })

        return res.status(200).json({
            projects: allUserProjects
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, users } = req.body

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })


        const project = await projectService.addUsersToProject({
            projectId,
            users,
            userId: loggedInUser._id
        })

        return res.status(200).json({
            project,
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }


}

export const getProjectById = async (req, res) => {

    const { projectId } = req.params;

    try {

        const project = await projectService.getProjectById({ projectId });

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, fileTree } = req.body;

        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        })

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const deleteProject = async (req, res) => {
    console.log('deleteProject controller called with params:', req.params);
    console.log('Authenticated user:', req.user);
    
    try {
        const { projectId } = req.params;
        console.log('Project ID from params:', projectId);
        
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        console.log('Logged in user from DB:', loggedInUser);

        if (!projectId) {
            console.error('No projectId provided');
            return res.status(400).json({ 
                success: false,
                error: "Project ID is required" 
            });
        }

        console.log('Calling projectService.deleteProject with:', { 
            projectId, 
            userId: loggedInUser?._id 
        });

        const result = await projectService.deleteProject({
            projectId,
            userId: loggedInUser._id
        });

        console.log('Project deletion result:', result);
        
        return res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    } catch (err) {
        console.error('Error in deleteProject controller:', {
            message: err.message,
            stack: err.stack,
            name: err.name
        });
        
        res.status(400).json({ 
            success: false,
            error: err.message || 'Failed to delete project' 
        });
    }
}