// ======================================================
// TASK MANAGEMENT JAVASCRIPT
// ======================================================

console.log("TASK MANAGEMENT SCRIPT LOADED");

const TASKS_API_URL = "http://localhost:5000/api/tasks";
const PROJECTS_API_URL = "http://localhost:5000/api/projects";

let tasks = [];
let projects = [];

let taskModal;


// ======================================================
// AUTHENTICATION
// ======================================================

function getToken() {
    return localStorage.getItem("token");
}


function getAuthHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}


function checkLogin() {

    const token = getToken();

    if (!token) {
        window.location.href = "login.html";
        return false;
    }

    return true;
}


function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}


// ======================================================
// API HELPER
// ======================================================

async function apiFetch(url, options = {}) {

    try {

        const response = await fetch(url, {
            ...options,

            headers: {
                ...getAuthHeaders(),
                ...(options.headers || {})
            }
        });


        // Token expired / invalid
        if (
            response.status === 401 ||
            response.status === 403
        ) {

            alert(
                "Your session has expired. Please login again."
            );

            logout();

            return null;
        }


        const text = await response.text();

        let data = {};

        try {

            data = text
                ? JSON.parse(text)
                : {};

        } catch (error) {

            throw new Error(
                "Invalid server response"
            );
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Request failed"
            );
        }


        return data;

    } catch (error) {

        console.error(
            "API ERROR:",
            error
        );

        throw error;
    }
}


// ======================================================
// LOAD PROJECTS
// ======================================================

async function loadProjects() {

    try {

        const data =
            await apiFetch(
                PROJECTS_API_URL
            );


        if (!data) {
            return;
        }


        projects = Array.isArray(data)
            ? data
            : [];


        populateProjectDropdowns();

    } catch (error) {

        console.error(
            "LOAD PROJECTS ERROR:",
            error
        );

        alert(
            "Failed to load projects: " +
            error.message
        );
    }
}


// ======================================================
// POPULATE PROJECT DROPDOWNS
// ======================================================

function populateProjectDropdowns() {

    const taskProject =
        document.getElementById(
            "taskProject"
        );

    const filterProject =
        document.getElementById(
            "filterProject"
        );


    // -------------------------------
    // Task modal project dropdown
    // -------------------------------

    if (taskProject) {

        taskProject.innerHTML = `
            <option value="">
                Select Project
            </option>
        `;


        projects.forEach(project => {

            const option =
                document.createElement("option");

            option.value =
                project._id;

            option.textContent =
                project.name;

            taskProject.appendChild(
                option
            );
        });
    }


    // -------------------------------
    // Filter project dropdown
    // -------------------------------

    if (filterProject) {

        filterProject.innerHTML = `
            <option value="">
                All Projects
            </option>
        `;


        projects.forEach(project => {

            const option =
                document.createElement("option");

            option.value =
                project._id;

            option.textContent =
                project.name;

            filterProject.appendChild(
                option
            );
        });
    }
}


// ======================================================
// LOAD TASKS
// ======================================================

async function loadTasks() {

    try {

        const search =
            document.getElementById(
                "searchTask"
            ).value.trim();


        const projectId =
            document.getElementById(
                "filterProject"
            ).value;


        const status =
            document.getElementById(
                "filterStatus"
            ).value;


        const priority =
            document.getElementById(
                "filterPriority"
            ).value;


        const params =
            new URLSearchParams();


        if (search) {
            params.append(
                "search",
                search
            );
        }


        if (projectId) {
            params.append(
                "projectId",
                projectId
            );
        }


        if (status) {
            params.append(
                "status",
                status
            );
        }


        if (priority) {
            params.append(
                "priority",
                priority
            );
        }


        const url =
            params.toString()
                ? `${TASKS_API_URL}?${params.toString()}`
                : TASKS_API_URL;


        const data =
            await apiFetch(url);


        if (!data) {
            return;
        }


        tasks = Array.isArray(data)
            ? data
            : [];


        displayTasks();

        updateStatistics();

    } catch (error) {

        console.error(
            "LOAD TASKS ERROR:",
            error
        );

        showTaskError(
            error.message
        );
    }
}


// ======================================================
// DISPLAY TASKS
// ======================================================

function displayTasks() {

    const tbody =
        document.getElementById(
            "tasksTableBody"
        );


    const taskCount =
        document.getElementById(
            "taskCount"
        );


    if (!tbody) {
        return;
    }


    taskCount.textContent =
        `${tasks.length} Task${tasks.length !== 1 ? "s" : ""}`;


    if (tasks.length === 0) {

        tbody.innerHTML = `

            <tr>

                <td colspan="6"
                    class="text-center py-5">

                    <div class="empty-state">

                        <i class="bi bi-inbox fs-1
                                  text-muted"></i>

                        <h5 class="mt-3">
                            No tasks found
                        </h5>

                        <p class="text-muted">
                            Create your first task
                            to get started.
                        </p>

                        <button
                            class="btn btn-primary"
                            onclick="openAddTaskModal()">

                            <i class="bi bi-plus-lg"></i>
                            Add Task

                        </button>

                    </div>

                </td>

            </tr>

        `;

        return;
    }


    tbody.innerHTML =
        tasks.map(task => {

            const project =
                getProjectById(
                    task.projectId
                );


            const projectName =
                project
                    ? project.name
                    : "Unknown Project";


            const dueDateHTML =
                getDueDateHTML(
                    task.dueDate,
                    task.status
                );


            const priorityBadge =
                getPriorityBadge(
                    task.priority
                );


            const statusBadge =
                getStatusBadge(
                    task.status
                );


            return `

                <tr>

                    <!-- TASK -->

                    <td>

                        <div class="fw-semibold">
                            ${escapeHTML(
                                task.title
                            )}
                        </div>

                        ${
                            task.description
                                ? `
                                <small
                                    class="text-muted
                                           task-description">

                                    ${escapeHTML(
                                        task.description
                                    )}

                                </small>
                                `
                                : ""
                        }

                    </td>


                    <!-- PROJECT -->

                    <td>

                        <span>
                            <i class="bi bi-folder2"></i>
                            ${escapeHTML(
                                projectName
                            )}
                        </span>

                    </td>


                    <!-- PRIORITY -->

                    <td>

                        ${priorityBadge}

                    </td>


                    <!-- STATUS -->

                    <td>

                        ${statusBadge}

                    </td>


                    <!-- DUE DATE -->

                    <td>

                        ${dueDateHTML}

                    </td>


                    <!-- ACTIONS -->

                    <td>

                        <div class="d-flex
                                    justify-content-center
                                    gap-1">

                            <button
                                class="btn btn-sm
                                       btn-outline-success"
                                title="Change Status"
                                onclick="quickStatus(
                                    '${task._id}'
                                )">

                                <i class="bi bi-arrow-repeat"></i>

                            </button>


                            <button
                                class="btn btn-sm
                                       btn-outline-primary"
                                title="Edit Task"
                                onclick="openEditTaskModal(
                                    '${task._id}'
                                )">

                                <i class="bi bi-pencil"></i>

                            </button>


                            <button
                                class="btn btn-sm
                                       btn-outline-danger"
                                title="Delete Task"
                                onclick="deleteTask(
                                    '${task._id}'
                                )">

                                <i class="bi bi-trash"></i>

                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join("");
}


// ======================================================
// GET PROJECT BY ID
// ======================================================

function getProjectById(projectId) {

    return projects.find(
        project =>
            String(project._id) ===
            String(projectId)
    );
}


// ======================================================
// PRIORITY BADGE
// ======================================================

function getPriorityBadge(priority) {

    let className =
        "badge bg-secondary";


    if (priority === "High") {
        className =
            "badge bg-danger";
    }

    else if (priority === "Medium") {
        className =
            "badge bg-warning text-dark";
    }

    else if (priority === "Low") {
        className =
            "badge bg-success";
    }


    return `
        <span class="${className}">
            ${escapeHTML(
                priority || "Medium"
            )}
        </span>
    `;
}


// ======================================================
// STATUS BADGE
// ======================================================

function getStatusBadge(status) {

    let className =
        "badge bg-secondary";


    if (status === "Todo") {

        className =
            "badge bg-secondary";

    }

    else if (status === "In Progress") {

        className =
            "badge bg-primary";

    }

    else if (status === "Completed") {

        className =
            "badge bg-success";
    }


    const text =
        status === "Todo"
            ? "To Do"
            : status;


    return `
        <span class="${className}">
            ${escapeHTML(text)}
        </span>
    `;
}


// ======================================================
// DUE DATE
// ======================================================

function getDueDateHTML(
    dueDate,
    status
) {

    if (!dueDate) {

        return `
            <span class="text-muted">
                No due date
            </span>
        `;
    }


    const formatted =
        formatDate(dueDate);


    const overdue =
        isOverdue(
            dueDate,
            status
        );


    if (overdue) {

        return `
            <span class="text-danger fw-semibold">

                <i class="bi bi-exclamation-circle"></i>

                ${formatted}

                <small>
                    (Overdue)
                </small>

            </span>
        `;
    }


    if (status === "Completed") {

        return `
            <span class="text-success">

                <i class="bi bi-check-circle"></i>

                ${formatted}

            </span>
        `;
    }


    return `
        <span>

            <i class="bi bi-calendar3"></i>

            ${formatted}

        </span>
    `;
}


// ======================================================
// DATE FORMAT
// ======================================================

function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString + "T00:00:00"
        );


    if (Number.isNaN(
        date.getTime()
    )) {
        return dateString;
    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


// ======================================================
// CHECK OVERDUE
// ======================================================

function isOverdue(
    dueDate,
    status
) {

    if (
        !dueDate ||
        status === "Completed"
    ) {
        return false;
    }


    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const due =
        new Date(
            dueDate + "T00:00:00"
        );


    return due < today;
}


// ======================================================
// STATISTICS
// ======================================================

function updateStatistics() {

    const total =
        tasks.length;


    const todo =
        tasks.filter(
            task =>
                task.status === "Todo"
        ).length;


    const inProgress =
        tasks.filter(
            task =>
                task.status === "In Progress"
        ).length;


    const completed =
        tasks.filter(
            task =>
                task.status === "Completed"
        ).length;


    document.getElementById(
        "totalTasks"
    ).textContent = total;


    document.getElementById(
        "todoTasks"
    ).textContent = todo;


    document.getElementById(
        "inProgressTasks"
    ).textContent = inProgress;


    document.getElementById(
        "completedTasks"
    ).textContent = completed;
}


// ======================================================
// OPEN ADD TASK MODAL
// ======================================================

function openAddTaskModal() {

    const form =
        document.getElementById(
            "taskForm"
        );


    form.reset();


    document.getElementById(
        "taskId"
    ).value = "";


    document.getElementById(
        "taskStatus"
    ).value = "Todo";


    document.getElementById(
        "taskPriority"
    ).value = "Medium";


    document.getElementById(
        "taskModalTitle"
    ).innerHTML = `

        <i class="bi bi-plus-circle"></i>
        Add Task

    `;


    document.getElementById(
        "saveTaskButton"
    ).innerHTML = `

        <i class="bi bi-save"></i>
        Save Task

    `;


    taskModal.show();
}


// ======================================================
// OPEN EDIT TASK MODAL
// ======================================================

function openEditTaskModal(taskId) {

    const task =
        tasks.find(
            item =>
                String(item._id) ===
                String(taskId)
        );


    if (!task) {

        alert(
            "Task not found."
        );

        return;
    }


    document.getElementById(
        "taskId"
    ).value = task._id;


    document.getElementById(
        "taskTitle"
    ).value =
        task.title || "";


    document.getElementById(
        "taskProject"
    ).value =
        task.projectId || "";


    document.getElementById(
        "taskStatus"
    ).value =
        task.status || "Todo";


    document.getElementById(
        "taskPriority"
    ).value =
        task.priority || "Medium";


    document.getElementById(
        "taskDueDate"
    ).value =
        task.dueDate || "";


    document.getElementById(
        "taskDescription"
    ).value =
        task.description || "";


    document.getElementById(
        "taskModalTitle"
    ).innerHTML = `

        <i class="bi bi-pencil-square"></i>
        Edit Task

    `;


    document.getElementById(
        "saveTaskButton"
    ).innerHTML = `

        <i class="bi bi-save"></i>
        Update Task

    `;


    taskModal.show();
}


// ======================================================
// SAVE TASK
// ======================================================

document.getElementById("taskForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const taskId = document.getElementById("taskId").value.trim();
    const title = document.getElementById("taskTitle").value.trim();
    const projectId = document.getElementById("taskProject").value;
    const status = document.getElementById("taskStatus").value;
    const priority = document.getElementById("taskPriority").value;
    const dueDate = document.getElementById("taskDueDate").value;
    const description = document.getElementById("taskDescription").value.trim();

    // Validate task title
    if (!title) {
        alert("Task title is required");
        return;
    }

    // Validate project
    if (!projectId) {
        alert("Please select a project");
        return;
    }

    // Task data
    const taskData = {
        title,
        projectId,
        status,
        priority,
        dueDate,
        description
    };

    try {
        // Create or Update URL
        const url = taskId
            ? `${TASKS_API_URL}/${taskId}`
            : TASKS_API_URL;

        // Save task
        const data = await apiFetch(url, {
            method: taskId ? "PUT" : "POST",
            body: JSON.stringify(taskData)
        });

        console.log("TASK RESPONSE:", data);

        // Success message
        alert(
            taskId
                ? "Task updated successfully"
                : "Task created successfully"
        );

        // Close modal
        const modalElement = document.getElementById("taskModal");
        const modal = bootstrap.Modal.getInstance(modalElement);

        if (modal) {
            modal.hide();
        }

        // Reset form
        document.getElementById("taskForm").reset();
        document.getElementById("taskId").value = "";

        // Reload tasks
        await loadTasks();

    } catch (error) {
        console.error("SAVE TASK ERROR:", error);
        alert(error.message || "Unable to connect to server");
    }
});


// ======================================================
// QUICK STATUS
// ======================================================

async function quickStatus(taskId) {

    const task =
        tasks.find(
            item =>
                String(item._id) ===
                String(taskId)
        );


    if (!task) {
        return;
    }


    let nextStatus;


    if (task.status === "Todo") {

        nextStatus = "In Progress";

    }

    else if (
        task.status === "In Progress"
    ) {

        nextStatus = "Completed";

    }

    else {

        nextStatus = "Todo";
    }


    try {

        const data =
            await apiFetch(
                `${TASKS_API_URL}/${taskId}/status`,
                {
                    method: "PATCH",

                    body:
                        JSON.stringify({
                            status:
                                nextStatus
                        })
                }
            );


        if (!data) {
            return;
        }


        await loadTasks();

    } catch (error) {

        console.error(
            "QUICK STATUS ERROR:",
            error
        );

        alert(
            error.message ||
            "Failed to update task status."
        );
    }
}


// ======================================================
// CLEAR FILTERS
// ======================================================

function clearFilters() {

    document.getElementById(
        "searchTask"
    ).value = "";


    document.getElementById(
        "filterProject"
    ).value = "";


    document.getElementById(
        "filterStatus"
    ).value = "";


    document.getElementById(
        "filterPriority"
    ).value = "";


    loadTasks();
}


// ======================================================
// SHOW ERROR
// ======================================================

function showTaskError(message) {

    const tbody =
        document.getElementById(
            "tasksTableBody"
        );


    tbody.innerHTML = `

        <tr>

            <td colspan="6"
                class="text-center
                       text-danger py-5">

                <i class="bi bi-exclamation-triangle
                          fs-2"></i>

                <h5 class="mt-2">
                    Failed to load tasks
                </h5>

                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>

                <button
                    class="btn btn-primary"
                    onclick="loadTasks()">

                    <i class="bi bi-arrow-clockwise"></i>
                    Try Again

                </button>

            </td>

        </tr>

    `;
}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ======================================================
// SEARCH / FILTER EVENTS
// ======================================================

function setupFilters() {

    const search =
        document.getElementById(
            "searchTask"
        );


    const project =
        document.getElementById(
            "filterProject"
        );


    const status =
        document.getElementById(
            "filterStatus"
        );


    const priority =
        document.getElementById(
            "filterPriority"
        );


    let searchTimer;


    search.addEventListener(
        "input",
        () => {

            clearTimeout(
                searchTimer
            );


            searchTimer =
                setTimeout(
                    () => {
                        loadTasks();
                    },
                    300
                );
        }
    );


    project.addEventListener(
        "change",
        loadTasks
    );


    status.addEventListener(
        "change",
        loadTasks
    );


    priority.addEventListener(
        "change",
        loadTasks
    );
}


// ======================================================
// INITIALIZE
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Initializing Task Management..."
        );


        // Check login
        if (!checkLogin()) {
            return;
        }


        // Create Bootstrap modal
        taskModal =
            new bootstrap.Modal(
                document.getElementById(
                    "taskModal"
                )
            );


        // Task form
        // document.getElementById(
        //     "taskForm"
        // ).addEventListener(
        //     "submit",
            
        // );


        // Filters
        setupFilters();


        // Load projects first
        await loadProjects();


        // Then load tasks
        await loadTasks();


        console.log(
            "Task Management initialized successfully."
        );
    }
);
// ======================================================
// DELETE TASK
// ======================================================

async function deleteTask(taskId) {
    if (!taskId) {
        alert("Invalid task ID");
        return;
    }

    const confirmDelete = confirm(
        "Are you sure you want to delete this task?"
    );

    if (!confirmDelete) {
        return;
    }

    try {
        console.log("Deleting task:", taskId);

        const data = await apiFetch(`${TASKS_API_URL}/${taskId}`, {
            method: "DELETE"
        });

        console.log("DELETE TASK RESPONSE:", data);

        alert("Task deleted successfully!");

        await loadTasks();

    } catch (error) {
        console.error("DELETE TASK ERROR:", error);

        alert(error.message || "Unable to delete task");
    }
}