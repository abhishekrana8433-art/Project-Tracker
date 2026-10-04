// ======================================================
// PROJECT TRACKER - BACKEND SERVER
// ======================================================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();


// ======================================================
// APP CONFIGURATION
// ======================================================

const app = express();

const PORT = process.env.PORT || 5000;

const MONGO_URI =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "project_tracker_secret_2026";

const DB_NAME = "project_tracker";


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(express.json());


// ======================================================
// DATABASE VARIABLES
// ======================================================

let mongoClient;
let db;

let usersCollection;
let projectsCollection;
let tasksCollection;


// ======================================================
// STATUS / PRIORITY CONSTANTS
// ======================================================

const PROJECT_STATUSES = [
    "Pending",
    "In Progress",
    "Completed"
];

const PROJECT_PRIORITIES = [
    "Low",
    "Medium",
    "High"
];

const TASK_STATUSES = [
    "Todo",
    "In Progress",
    "Completed"
];

const TASK_PRIORITIES = [
    "Low",
    "Medium",
    "High"
];


// ======================================================
// DATABASE CONNECTION
// ======================================================

async function connectDatabase() {
    try {
        mongoClient = new MongoClient(MONGO_URI);

        await mongoClient.connect();

        db = mongoClient.db(DB_NAME);

        usersCollection = db.collection("users");
        projectsCollection = db.collection("projects");
        tasksCollection = db.collection("tasks");

        // ------------------------------------------------
        // USER INDEX
        // ------------------------------------------------

        await usersCollection.createIndex(
            {
                email: 1
            },
            {
                unique: true
            }
        );

        // ------------------------------------------------
        // PROJECT INDEXES
        // ------------------------------------------------

        await projectsCollection.createIndex({
            userId: 1
        });

        await projectsCollection.createIndex({
            userId: 1,
            status: 1
        });

        // ------------------------------------------------
        // TASK INDEXES
        // ------------------------------------------------

        await tasksCollection.createIndex({
            userId: 1,
            projectId: 1
        });

        await tasksCollection.createIndex({
            userId: 1,
            status: 1
        });

        await tasksCollection.createIndex({
            userId: 1,
            dueDate: 1
        });

        console.log("MongoDB connected successfully!");

    } catch (error) {
        console.error(
            "MongoDB connection error:",
            error
        );

        process.exit(1);
    }
}


// ======================================================
// JWT AUTHENTICATION MIDDLEWARE
// ======================================================

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authentication token required"
        });
    }

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Invalid authorization format"
        });
    }

    const token =
        authHeader.substring(7);

    if (!token) {
        return res.status(401).json({
            message: "Authentication token required"
        });
    }

    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );

        req.user = decoded;

        next();

    } catch (error) {

        console.error(
            "JWT ERROR:",
            error.message
        );

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}


// ======================================================
// ROOT ROUTE
// ======================================================

app.get("/", (req, res) => {

    res.json({
        message:
            "Project Tracker API is running!"
    });

});


// ======================================================
// TEST ROUTE
// ======================================================

app.get("/api/test", authenticateToken, (req, res) => {

    res.json({
        message: "Authentication successful",
        user: req.user
    });

});


// ======================================================
// REGISTER
// ======================================================

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;

            // --------------------------------------------
            // VALIDATION
            // --------------------------------------------

            if (
                !name ||
                !name.trim()
            ) {
                return res.status(400).json({
                    message: "Name is required"
                });
            }

            if (
                !email ||
                !email.trim()
            ) {
                return res.status(400).json({
                    message: "Email is required"
                });
            }

            if (!password) {
                return res.status(400).json({
                    message: "Password is required"
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    message:
                        "Password must be at least 6 characters"
                });
            }

            const cleanEmail =
                email.trim().toLowerCase();

            // --------------------------------------------
            // CHECK EXISTING USER
            // --------------------------------------------

            const existingUser =
                await usersCollection.findOne({
                    email: cleanEmail
                });

            if (existingUser) {
                return res.status(409).json({
                    message:
                        "Email already registered"
                });
            }

            // --------------------------------------------
            // HASH PASSWORD
            // --------------------------------------------

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            // --------------------------------------------
            // CREATE USER
            // --------------------------------------------

            const newUser = {

                name: name.trim(),

                email: cleanEmail,

                password: hashedPassword,

                createdAt: new Date(),

                updatedAt: new Date()

            };

            const result =
                await usersCollection.insertOne(
                    newUser
                );

            // --------------------------------------------
            // JWT
            // --------------------------------------------

            const token =
                jwt.sign(
                    {
                        userId:
                            result.insertedId.toString(),

                        name:
                            newUser.name,

                        email:
                            newUser.email
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

            res.status(201).json({

                message:
                    "Registration successful",

                token,

                user: {
                    id:
                        result.insertedId.toString(),

                    name:
                        newUser.name,

                    email:
                        newUser.email
                }

            });

        } catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Registration failed"
            });
        }

    }
);


// ======================================================
// LOGIN
// ======================================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (
                !email ||
                !email.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Email is required"
                });
            }

            if (!password) {
                return res.status(400).json({
                    message:
                        "Password is required"
                });
            }

            const cleanEmail =
                email.trim().toLowerCase();

            const user =
                await usersCollection.findOne({
                    email: cleanEmail
                });

            if (!user) {
                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {
                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });
            }

            const token =
                jwt.sign(
                    {
                        userId:
                            user._id.toString(),

                        name:
                            user.name,

                        email:
                            user.email
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

            res.json({

                message:
                    "Login successful",

                token,

                user: {
                    id:
                        user._id.toString(),

                    name:
                        user.name,

                    email:
                        user.email
                }

            });

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Login failed"
            });
        }

    }
);


// ======================================================
// CHANGE PASSWORD
// ======================================================

app.post(
    "/api/auth/change-password",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                currentPassword,
                newPassword
            } = req.body;

            if (!currentPassword) {
                return res.status(400).json({
                    message:
                        "Current password is required"
                });
            }

            if (!newPassword) {
                return res.status(400).json({
                    message:
                        "New password is required"
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    message:
                        "New password must be at least 6 characters"
                });
            }

            const user =
                await usersCollection.findOne({
                    _id:
                        new ObjectId(
                            req.user.userId
                        )
                });

            if (!user) {
                return res.status(404).json({
                    message:
                        "User not found"
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    currentPassword,
                    user.password
                );

            if (!passwordMatch) {
                return res.status(401).json({
                    message:
                        "Current password is incorrect"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );

            await usersCollection.updateOne(
                {
                    _id:
                        new ObjectId(
                            req.user.userId
                        )
                },
                {
                    $set: {
                        password:
                            hashedPassword,

                        updatedAt:
                            new Date()
                    }
                }
            );

            res.json({
                message:
                    "Password changed successfully"
            });

        } catch (error) {

            console.error(
                "CHANGE PASSWORD ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to change password"
            });
        }

    }
);


// ======================================================
// GET PROJECTS
// ======================================================

app.get(
    "/api/projects",
    authenticateToken,
    async (req, res) => {

        try {

            const projects =
                await projectsCollection
                    .find({
                        userId:
                            req.user.userId
                    })
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

            res.json(projects);

        } catch (error) {

            console.error(
                "GET PROJECTS ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load projects"
            });
        }

    }
);


// ======================================================
// GET SINGLE PROJECT
// ======================================================

app.get(
    "/api/projects/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid project ID"
                });
            }

            const project =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            if (!project) {
                return res.status(404).json({
                    message:
                        "Project not found"
                });
            }

            res.json(project);

        } catch (error) {

            console.error(
                "GET PROJECT ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load project"
            });
        }

    }
);


// ======================================================
// CREATE PROJECT
// ======================================================

app.post(
    "/api/projects",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                name,
                status = "Pending",
                priority = "Medium",
                progress = 0,
                start_date = "",
                deadline = "",
                description = ""
            } = req.body;

            if (
                !name ||
                !name.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Project name is required"
                });
            }

            const finalStatus =
                PROJECT_STATUSES.includes(status)
                    ? status
                    : "Pending";

            const finalPriority =
                PROJECT_PRIORITIES.includes(priority)
                    ? priority
                    : "Medium";

            let finalProgress =
                Number(progress);

            if (
                Number.isNaN(finalProgress)
            ) {
                finalProgress = 0;
            }

            finalProgress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        finalProgress
                    )
                );

            const newProject = {

                name:
                    name.trim(),

                status:
                    finalStatus,

                priority:
                    finalPriority,

                progress:
                    finalProgress,

                start_date:
                    start_date || "",

                deadline:
                    deadline || "",

                description:
                    String(
                        description || ""
                    ).trim(),

                userId:
                    req.user.userId,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };

            const result =
                await projectsCollection.insertOne(
                    newProject
                );

            res.status(201).json({

                message:
                    "Project created successfully",

                project: {
                    _id:
                        result.insertedId,

                    ...newProject
                }

            });

        } catch (error) {

            console.error(
                "CREATE PROJECT ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create project"
            });
        }

    }
);


// ======================================================
// UPDATE PROJECT
// ======================================================

app.put(
    "/api/projects/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid project ID"
                });
            }

            const {
                name,
                status = "Pending",
                priority = "Medium",
                progress = 0,
                start_date = "",
                deadline = "",
                description = ""
            } = req.body;

            if (
                !name ||
                !name.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Project name is required"
                });
            }

            const finalStatus =
                PROJECT_STATUSES.includes(status)
                    ? status
                    : "Pending";

            const finalPriority =
                PROJECT_PRIORITIES.includes(priority)
                    ? priority
                    : "Medium";

            let finalProgress =
                Number(progress);

            if (
                Number.isNaN(finalProgress)
            ) {
                finalProgress = 0;
            }

            finalProgress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        finalProgress
                    )
                );

            const updateData = {

                name:
                    name.trim(),

                status:
                    finalStatus,

                priority:
                    finalPriority,

                progress:
                    finalProgress,

                start_date:
                    start_date || "",

                deadline:
                    deadline || "",

                description:
                    String(
                        description || ""
                    ).trim(),

                updatedAt:
                    new Date()

            };

            const result =
                await projectsCollection.updateOne(
                    {
                        _id:
                            new ObjectId(
                                req.params.id
                            ),

                        userId:
                            req.user.userId
                    },
                    {
                        $set:
                            updateData
                    }
                );

            if (
                result.matchedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Project not found"
                });
            }

            const updatedProject =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            res.json({

                message:
                    "Project updated successfully",

                project:
                    updatedProject

            });

        } catch (error) {

            console.error(
                "UPDATE PROJECT ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update project"
            });
        }

    }
);


// ======================================================
// DELETE PROJECT
// ======================================================

app.delete(
    "/api/projects/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid project ID"
                });
            }

            const projectId =
                new ObjectId(
                    req.params.id
                );

            const project =
                await projectsCollection.findOne({
                    _id:
                        projectId,

                    userId:
                        req.user.userId
                });

            if (!project) {
                return res.status(404).json({
                    message:
                        "Project not found"
                });
            }

            // --------------------------------------------
            // DELETE PROJECT
            // --------------------------------------------

            await projectsCollection.deleteOne({
                _id:
                    projectId,

                userId:
                    req.user.userId
            });

            // --------------------------------------------
            // DELETE RELATED TASKS
            // --------------------------------------------

            await tasksCollection.deleteMany({
                projectId:
                    req.params.id,

                userId:
                    req.user.userId
            });

            res.json({
                message:
                    "Project deleted successfully"
            });

        } catch (error) {

            console.error(
                "DELETE PROJECT ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete project"
            });
        }

    }
);


// ======================================================
// TASK MANAGEMENT
// ======================================================


// ======================================================
// GET ALL TASKS
// ======================================================

app.get(
    "/api/tasks",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                projectId = "",
                status = "",
                priority = "",
                search = ""
            } = req.query;

            const query = {
                userId:
                    req.user.userId
            };

            // --------------------------------------------
            // PROJECT FILTER
            // --------------------------------------------

            if (projectId.trim()) {

                if (
                    !ObjectId.isValid(
                        projectId
                    )
                ) {
                    return res.status(400).json({
                        message:
                            "Invalid project ID"
                    });
                }

                query.projectId =
                    projectId.trim();
            }

            // --------------------------------------------
            // STATUS FILTER
            // --------------------------------------------

            if (status.trim()) {

                if (
                    !TASK_STATUSES.includes(
                        status.trim()
                    )
                ) {
                    return res.status(400).json({
                        message:
                            "Invalid task status"
                    });
                }

                query.status =
                    status.trim();
            }

            // --------------------------------------------
            // PRIORITY FILTER
            // --------------------------------------------

            if (priority.trim()) {

                if (
                    !TASK_PRIORITIES.includes(
                        priority.trim()
                    )
                ) {
                    return res.status(400).json({
                        message:
                            "Invalid task priority"
                    });
                }

                query.priority =
                    priority.trim();
            }

            // --------------------------------------------
            // SEARCH
            // --------------------------------------------

            if (search.trim()) {

                const searchText =
                    search.trim();

                query.$or = [

                    {
                        title: {
                            $regex:
                                searchText,
                            $options:
                                "i"
                        }
                    },

                    {
                        description: {
                            $regex:
                                searchText,
                            $options:
                                "i"
                        }
                    }

                ];
            }

            const tasks =
                await tasksCollection
                    .find(query)
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

            res.json(tasks);

        } catch (error) {

            console.error(
                "GET TASKS ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load tasks"
            });
        }

    }
);


// ======================================================
// GET SINGLE TASK
// ======================================================

app.get(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }

            const task =
                await tasksCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            if (!task) {
                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }

            res.json(task);

        } catch (error) {

            console.error(
                "GET TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load task"
            });
        }

    }
);


// ======================================================
// CREATE TASK
// ======================================================

app.post(
    "/api/tasks",
    authenticateToken,
    async (req, res) => {

        try {

            console.log(
                "=============================="
            );

            console.log(
                "CREATE TASK ROUTE HIT"
            );

            console.log(
                "TASK DATA RECEIVED:",
                req.body
            );

            const {
                title,
                description = "",
                projectId,
                status = "Todo",
                priority = "Medium",
                dueDate = ""
            } = req.body;

            // --------------------------------------------
            // TITLE VALIDATION
            // --------------------------------------------

            if (
                !title ||
                !title.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Task title is required"
                });
            }

            // --------------------------------------------
            // PROJECT VALIDATION
            // --------------------------------------------

            if (
                !projectId ||
                !ObjectId.isValid(
                    projectId
                )
            ) {
                return res.status(400).json({
                    message:
                        "Valid project is required"
                });
            }

            // --------------------------------------------
            // CHECK PROJECT OWNERSHIP
            // --------------------------------------------

            const project =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(
                            projectId
                        ),

                    userId:
                        req.user.userId
                });

            if (!project) {
                return res.status(404).json({
                    message:
                        "Project not found or you do not have access to it"
                });
            }

            // --------------------------------------------
            // VALID STATUS
            // --------------------------------------------

            const finalStatus =
                TASK_STATUSES.includes(
                    status
                )
                    ? status
                    : "Todo";

            // --------------------------------------------
            // VALID PRIORITY
            // --------------------------------------------

            const finalPriority =
                TASK_PRIORITIES.includes(
                    priority
                )
                    ? priority
                    : "Medium";

            // --------------------------------------------
            // CREATE TASK
            // --------------------------------------------

            const newTask = {

                title:
                    title.trim(),

                description:
                    String(
                        description || ""
                    ).trim(),

                projectId:
                    projectId,

                userId:
                    req.user.userId,

                status:
                    finalStatus,

                priority:
                    finalPriority,

                dueDate:
                    dueDate || "",

                createdAt:
                    new Date(),

                updatedAt:
                    new Date(),

                completedAt:
                    finalStatus === "Completed"
                        ? new Date()
                        : null

            };

            console.log(
                "TASK BEING SAVED:",
                newTask
            );

            const result =
                await tasksCollection.insertOne(
                    newTask
                );

            console.log(
                "TASK SAVED:",
                result.insertedId
            );

            res.status(201).json({

                message:
                    "Task created successfully",

                task: {

                    _id:
                        result.insertedId,

                    ...newTask

                }

            });

        } catch (error) {

            console.error(
                "CREATE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create task"
            });
        }

    }
);


// ======================================================
// UPDATE TASK
// ======================================================

app.put(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }

            const {
                title,
                description = "",
                projectId,
                status = "Todo",
                priority = "Medium",
                dueDate = ""
            } = req.body;

            // --------------------------------------------
            // TITLE
            // --------------------------------------------

            if (
                !title ||
                !title.trim()
            ) {
                return res.status(400).json({
                    message:
                        "Task title is required"
                });
            }

            // --------------------------------------------
            // PROJECT
            // --------------------------------------------

            if (
                !projectId ||
                !ObjectId.isValid(
                    projectId
                )
            ) {
                return res.status(400).json({
                    message:
                        "Valid project is required"
                });
            }

            // --------------------------------------------
            // PROJECT OWNERSHIP
            // --------------------------------------------

            const project =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(
                            projectId
                        ),

                    userId:
                        req.user.userId
                });

            if (!project) {
                return res.status(404).json({
                    message:
                        "Project not found or you do not have access to it"
                });
            }

            // --------------------------------------------
            // EXISTING TASK
            // --------------------------------------------

            const existingTask =
                await tasksCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            if (!existingTask) {
                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }

            // --------------------------------------------
            // STATUS
            // --------------------------------------------

            const finalStatus =
                TASK_STATUSES.includes(
                    status
                )
                    ? status
                    : "Todo";

            // --------------------------------------------
            // PRIORITY
            // --------------------------------------------

            const finalPriority =
                TASK_PRIORITIES.includes(
                    priority
                )
                    ? priority
                    : "Medium";

            // --------------------------------------------
            // UPDATE DATA
            // --------------------------------------------

            const updateData = {

                title:
                    title.trim(),

                description:
                    String(
                        description || ""
                    ).trim(),

                projectId:
                    projectId,

                status:
                    finalStatus,

                priority:
                    finalPriority,

                dueDate:
                    dueDate || "",

                updatedAt:
                    new Date(),

                completedAt:
                    finalStatus === "Completed"
                        ? (
                            existingTask.completedAt ||
                            new Date()
                        )
                        : null

            };

            const result =
                await tasksCollection.updateOne(
                    {
                        _id:
                            new ObjectId(
                                req.params.id
                            ),

                        userId:
                            req.user.userId
                    },
                    {
                        $set:
                            updateData
                    }
                );

            if (
                result.matchedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }

            const updatedTask =
                await tasksCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            res.json({

                message:
                    "Task updated successfully",

                task:
                    updatedTask

            });

        } catch (error) {

            console.error(
                "UPDATE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update task"
            });
        }

    }
);


// ======================================================
// QUICK UPDATE TASK STATUS
// ======================================================

app.patch(
    "/api/tasks/:id/status",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }

            const {
                status
            } = req.body;

            if (
                !TASK_STATUSES.includes(
                    status
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid task status"
                });
            }

            const completedAt =
                status === "Completed"
                    ? new Date()
                    : null;

            const result =
                await tasksCollection.updateOne(
                    {
                        _id:
                            new ObjectId(
                                req.params.id
                            ),

                        userId:
                            req.user.userId
                    },
                    {
                        $set: {

                            status:
                                status,

                            completedAt:
                                completedAt,

                            updatedAt:
                                new Date()

                        }
                    }
                );

            if (
                result.matchedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }

            const updatedTask =
                await tasksCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            res.json({

                message:
                    "Task status updated successfully",

                task:
                    updatedTask

            });

        } catch (error) {

            console.error(
                "UPDATE TASK STATUS ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update task status"
            });
        }

    }
);


// ======================================================
// DELETE TASK
// ======================================================

app.delete(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (
                !ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }

            const result =
                await tasksCollection.deleteOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });

            if (
                result.deletedCount === 0
            ) {
                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }

            res.json({
                message:
                    "Task deleted successfully"
            });

        } catch (error) {

            console.error(
                "DELETE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete task"
            });
        }

    }
);


// ======================================================
// TASK MANAGEMENT
// ======================================================

// const TASK_STATUSES = [
//     "Todo",
//     "In Progress",
//     "Completed"
// ];

// const TASK_PRIORITIES = [
//     "Low",
//     "Medium",
//     "High"
// ];


// ======================================================
// GET ALL TASKS
// ======================================================

app.get(
    "/api/tasks",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                projectId = "",
                status = "",
                priority = "",
                search = ""
            } = req.query;

            const query = {
                userId: req.user.userId
            };

            if (projectId.trim()) {

                if (!ObjectId.isValid(projectId)) {
                    return res.status(400).json({
                        message: "Invalid project ID"
                    });
                }

                query.projectId = projectId.trim();
            }

            if (status.trim()) {

                if (!TASK_STATUSES.includes(status.trim())) {
                    return res.status(400).json({
                        message: "Invalid task status"
                    });
                }

                query.status = status.trim();
            }

            if (priority.trim()) {

                if (!TASK_PRIORITIES.includes(priority.trim())) {
                    return res.status(400).json({
                        message: "Invalid task priority"
                    });
                }

                query.priority = priority.trim();
            }

            if (search.trim()) {

                query.$or = [
                    {
                        title: {
                            $regex: search.trim(),
                            $options: "i"
                        }
                    },
                    {
                        description: {
                            $regex: search.trim(),
                            $options: "i"
                        }
                    }
                ];
            }

            const tasks = await tasksCollection
                .find(query)
                .sort({
                    createdAt: -1
                })
                .toArray();

            res.json(tasks);

        } catch (error) {

            console.error(
                "GET TASKS ERROR:",
                error
            );

            res.status(500).json({
                message: "Failed to load tasks"
            });
        }
    }
);


// ======================================================
// GET SINGLE TASK
// ======================================================

app.get(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid task ID"
                });
            }

            const task = await tasksCollection.findOne({
                _id: new ObjectId(req.params.id),
                userId: req.user.userId
            });

            if (!task) {
                return res.status(404).json({
                    message: "Task not found"
                });
            }

            res.json(task);

        } catch (error) {

            console.error(
                "GET TASK ERROR:",
                error
            );

            res.status(500).json({
                message: "Failed to load task"
            });
        }
    }
);


// ======================================================
// CREATE TASK
// ======================================================

app.post(
    "/api/tasks",
    authenticateToken,
    async (req, res) => {

        try {

            console.log(
                "=============================="
            );

            console.log(
                "CREATE TASK ROUTE HIT"
            );

            console.log(
                "TASK DATA RECEIVED:",
                req.body
            );

            const {
                title,
                description = "",
                projectId,
                status = "Todo",
                priority = "Medium",
                dueDate = ""
            } = req.body;


            // ------------------------------------------
            // TITLE VALIDATION
            // ------------------------------------------

            if (!title || !title.trim()) {

                return res.status(400).json({
                    message:
                        "Task title is required"
                });
            }


            // ------------------------------------------
            // PROJECT VALIDATION
            // ------------------------------------------

            if (
                !projectId ||
                !ObjectId.isValid(projectId)
            ) {

                return res.status(400).json({
                    message:
                        "Valid project is required"
                });
            }


            // ------------------------------------------
            // CHECK PROJECT
            // ------------------------------------------

            const project =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(projectId),

                    userId:
                        req.user.userId
                });


            if (!project) {

                return res.status(404).json({
                    message:
                        "Project not found or you do not have access to it"
                });
            }


            // ------------------------------------------
            // STATUS
            // ------------------------------------------

            const finalStatus =
                TASK_STATUSES.includes(status)
                    ? status
                    : "Todo";


            // ------------------------------------------
            // PRIORITY
            // ------------------------------------------

            const finalPriority =
                TASK_PRIORITIES.includes(priority)
                    ? priority
                    : "Medium";


            // ------------------------------------------
            // CREATE TASK OBJECT
            // ------------------------------------------

            const newTask = {

                title:
                    title.trim(),

                description:
                    String(
                        description || ""
                    ).trim(),

                projectId:
                    projectId,

                userId:
                    req.user.userId,

                status:
                    finalStatus,

                priority:
                    finalPriority,

                dueDate:
                    dueDate || "",

                createdAt:
                    new Date(),

                updatedAt:
                    new Date(),

                completedAt:
                    finalStatus === "Completed"
                        ? new Date()
                        : null
            };


            console.log(
                "TASK BEING SAVED:",
                newTask
            );


            // ------------------------------------------
            // SAVE TASK
            // ------------------------------------------

            const result =
                await tasksCollection.insertOne(
                    newTask
                );


            console.log(
                "TASK SAVED:",
                result.insertedId
            );


            res.status(201).json({

                message:
                    "Task created successfully",

                task: {
                    _id:
                        result.insertedId,

                    ...newTask
                }

            });

        } catch (error) {

            console.error(
                "CREATE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to create task"
            });
        }
    }
);


// ======================================================
// UPDATE TASK
// ======================================================

app.put(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid task ID"
                });
            }

            const {
                title,
                description = "",
                projectId,
                status = "Todo",
                priority = "Medium",
                dueDate = ""
            } = req.body;


            if (!title || !title.trim()) {

                return res.status(400).json({
                    message:
                        "Task title is required"
                });
            }


            if (
                !projectId ||
                !ObjectId.isValid(projectId)
            ) {

                return res.status(400).json({
                    message:
                        "Valid project is required"
                });
            }


            const project =
                await projectsCollection.findOne({
                    _id:
                        new ObjectId(projectId),

                    userId:
                        req.user.userId
                });


            if (!project) {

                return res.status(404).json({
                    message:
                        "Project not found or you do not have access to it"
                });
            }


            const existingTask =
                await tasksCollection.findOne({
                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId
                });


            if (!existingTask) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }


            const finalStatus =
                TASK_STATUSES.includes(status)
                    ? status
                    : "Todo";


            const finalPriority =
                TASK_PRIORITIES.includes(priority)
                    ? priority
                    : "Medium";


            const updateData = {

                title:
                    title.trim(),

                description:
                    String(
                        description || ""
                    ).trim(),

                projectId:
                    projectId,

                status:
                    finalStatus,

                priority:
                    finalPriority,

                dueDate:
                    dueDate || "",

                updatedAt:
                    new Date(),

                completedAt:
                    finalStatus === "Completed"
                        ? (
                            existingTask.completedAt ||
                            new Date()
                        )
                        : null
            };


            const result =
                await tasksCollection.updateOne(

                    {
                        _id:
                            new ObjectId(
                                req.params.id
                            ),

                        userId:
                            req.user.userId
                    },

                    {
                        $set:
                            updateData
                    }
                );


            if (result.matchedCount === 0) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }


            const updatedTask =
                await tasksCollection.findOne({

                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId

                });


            res.json({

                message:
                    "Task updated successfully",

                task:
                    updatedTask

            });

        } catch (error) {

            console.error(
                "UPDATE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update task"
            });
        }
    }
);


// ======================================================
// QUICK UPDATE TASK STATUS
// ======================================================

app.patch(
    "/api/tasks/:id/status",
    authenticateToken,
    async (req, res) => {

        try {

            if (!ObjectId.isValid(req.params.id)) {

                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }

            const {
                status
            } = req.body;


            if (!TASK_STATUSES.includes(status)) {

                return res.status(400).json({
                    message:
                        "Invalid task status"
                });
            }


            const completedAt =
                status === "Completed"
                    ? new Date()
                    : null;


            const result =
                await tasksCollection.updateOne(

                    {
                        _id:
                            new ObjectId(
                                req.params.id
                            ),

                        userId:
                            req.user.userId
                    },

                    {
                        $set: {

                            status:
                                status,

                            completedAt:
                                completedAt,

                            updatedAt:
                                new Date()

                        }
                    }
                );


            if (result.matchedCount === 0) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }


            const updatedTask =
                await tasksCollection.findOne({

                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId

                });


            res.json({

                message:
                    "Task status updated successfully",

                task:
                    updatedTask

            });

        } catch (error) {

            console.error(
                "UPDATE TASK STATUS ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to update task status"
            });
        }
    }
);


// ======================================================
// DELETE TASK
// ======================================================

app.delete(
    "/api/tasks/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (!ObjectId.isValid(req.params.id)) {

                return res.status(400).json({
                    message:
                        "Invalid task ID"
                });
            }


            const result =
                await tasksCollection.deleteOne({

                    _id:
                        new ObjectId(
                            req.params.id
                        ),

                    userId:
                        req.user.userId

                });


            if (result.deletedCount === 0) {

                return res.status(404).json({
                    message:
                        "Task not found"
                });
            }


            res.json({

                message:
                    "Task deleted successfully"

            });

        } catch (error) {

            console.error(
                "DELETE TASK ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to delete task"
            });
        }
    }
);


// ======================================================
// TASK STATISTICS
// ======================================================

app.get(
    "/api/tasks/stats",
    authenticateToken,
    async (req, res) => {

        try {

            const userId =
                req.user.userId;


            const totalTasks =
                await tasksCollection.countDocuments({
                    userId:
                        userId
                });


            const todoTasks =
                await tasksCollection.countDocuments({
                    userId:
                        userId,

                    status:
                        "Todo"
                });


            const inProgressTasks =
                await tasksCollection.countDocuments({
                    userId:
                        userId,

                    status:
                        "In Progress"
                });


            const completedTasks =
                await tasksCollection.countDocuments({
                    userId:
                        userId,

                    status:
                        "Completed"
                });


            res.json({

                totalTasks,

                todoTasks,

                inProgressTasks,

                completedTasks

            });

        } catch (error) {

            console.error(
                "TASK STATS ERROR:",
                error
            );

            res.status(500).json({
                message:
                    "Failed to load task statistics"
            });
        }
    }
);


// ======================================================
// 404 HANDLER
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({
            message:
                "Route not found"
        });

    }
);


// ======================================================
// START SERVER
// ======================================================

async function startServer() {

    try {

        await connectDatabase();

        const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

    } catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(1);
    }
}


// ======================================================
// START
// ======================================================

startServer();