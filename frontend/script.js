console.log("PROJECT TRACKER SCRIPT v3 LOADED");

const API_URL = "http://localhost:5000/api/projects";
const TASK_API_URL = "http://localhost:5000/api/tasks";

console.log("API URL:", API_URL);

let projects = [];
let tasks = [];

let statusChart = null;
let priorityChart = null;

let projectProgressChart = null;
let taskStatusChart = null;
let taskPriorityChart = null;

let calendarDate = new Date();

// ===============================
// AUTH
// ===============================

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

// ===============================
// LOGOUT
// ===============================

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "login.html";
}

// ===============================
// LOAD USER
// ===============================

function loadUser() {
    const userData = localStorage.getItem("user");

    if (!userData) {
        return;
    }

    try {
        const user = JSON.parse(userData);

        const welcomeUser =
            document.getElementById("welcomeUser");

        if (welcomeUser) {
            welcomeUser.textContent =
                `Welcome, ${user.name || user.email}`;
        }

    } catch (error) {
        console.error("User data error:", error);
    }
}
// OPEN PROFILE MODAL
function openProfileModal() {
    const userData =
        localStorage.getItem("user");

    if (!userData) {
        alert("User information not found.");
        return;
    }

    try {
        const user = JSON.parse(userData);

        const nameInput =
            document.getElementById("profileName");

        const emailInput =
            document.getElementById("profileEmail");

        if (nameInput) {
            nameInput.value =
                user.name || "Not available";
        }

        if (emailInput) {
            emailInput.value =
                user.email || "Not available";
        }

        const modalElement =
            document.getElementById("profileModal");

        if (modalElement) {
            const modal =
                bootstrap.Modal.getOrCreateInstance(
                    modalElement
                );

            modal.show();
        }

    } catch (error) {
        console.error(
            "Profile error:",
            error
        );

        alert(
            "Unable to load profile information."
        );
    }
}
// ===============================
// CHANGE PASSWORD
// ===============================

async function changePassword(event) {

    event.preventDefault();

    const currentPassword =
        document.getElementById("currentPassword").value;

    const newPassword =
        document.getElementById("newPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    const messageElement =
        document.getElementById("passwordMessage");

    if (newPassword !== confirmPassword) {

        messageElement.className = "alert alert-danger mt-3";
        messageElement.textContent =
            "New passwords do not match.";

        return;
    }

    if (newPassword.length < 6) {

        messageElement.className = "alert alert-danger mt-3";
        messageElement.textContent =
            "Password must contain at least 6 characters.";

        return;
    }

    try {

        const response = await fetch(
            "http://localhost:5000/api/auth/change-password",
            {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            }
        );

        const responseText = await response.text();

console.log("CHANGE PASSWORD STATUS:", response.status);
console.log("CHANGE PASSWORD RESPONSE:", responseText);

let result;

try {
    result = JSON.parse(responseText);
} catch (error) {
    throw new Error(
        `Server returned HTML instead of JSON. HTTP Status: ${response.status}. Check backend route and port 5000.`
    );
}

        if (!response.ok) {
            throw new Error(
                result.message || "Password change failed"
            );
        }

        messageElement.className = "alert alert-success mt-3";
        messageElement.textContent =
            "Password changed successfully!";

        document.getElementById("changePasswordForm").reset();

    } catch (error) {

        console.error("Change password error:", error);

        messageElement.className = "alert alert-danger mt-3";
        messageElement.textContent = error.message;

    }
}


// ===============================
// LOAD PROJECTS
// ===============================

async function loadProjects() {

    if (!checkLogin()) {
        return;
    }

    try {

        console.log("Loading all projects...");

        const response = await fetch(
            API_URL,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                logout();
                return;
            }

            throw new Error(
                data.message || "Failed to load projects"
            );
        }

        projects = Array.isArray(data) ? data : [];

        console.log("Projects loaded:", projects);

        displayProjects();
        updateStatistics();
        renderCalendar();

        // Refresh dashboard analytics
        createProjectProgressChart();

    } catch (error) {

        console.error("Load projects error:", error);

        const container =
            document.getElementById("projectContainer");

        if (container) {

            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        Failed to load projects.
                        ${escapeHTML(error.message)}
                    </div>
                </div>
            `;
        }
    }
}

// ===============================
// DISPLAY PROJECTS
// ===============================

function displayProjects() {

    const container =
        document.getElementById("projectContainer");

    if (!container) {
        return;
    }

    // ===============================
    // GET FILTER VALUES
    // ===============================

    const search =
        document.getElementById("searchInput")?.value
            .trim()
            .toLowerCase() || "";

    const status =
        document.getElementById("statusFilter")?.value || "";

    const priority =
        document.getElementById("priorityFilter")?.value || "";

    const sortValue =
        document.getElementById("sortFilter")?.value || "";


    // ===============================
    // COPY PROJECTS
    // ===============================

    let filteredProjects = [...projects];


    // ===============================
    // SEARCH FILTER
    // ===============================

    if (search) {

        filteredProjects =
            filteredProjects.filter(function (project) {

                const name =
                    String(project.name || "").toLowerCase();

                const description =
                    String(project.description || "").toLowerCase();

                return (
                    name.includes(search) ||
                    description.includes(search)
                );

            });
    }


    // ===============================
    // STATUS FILTER
    // ===============================

    if (status) {

        filteredProjects =
            filteredProjects.filter(function (project) {

                return project.status === status;

            });
    }


    // ===============================
    // PRIORITY FILTER
    // ===============================

    if (priority) {

        filteredProjects =
            filteredProjects.filter(function (project) {

                return project.priority === priority;

            });
    }


    // ===============================
    // SORT PROJECTS
    // ===============================

    filteredProjects.sort(function (a, b) {

        switch (sortValue) {

            case "name-asc":

                return (a.name || "")
                    .localeCompare(b.name || "");


            case "name-desc":

                return (b.name || "")
                    .localeCompare(a.name || "");


            case "deadline-asc":

                return compareDates(
                    a.deadline,
                    b.deadline
                );


            case "deadline-desc":

                return compareDates(
                    b.deadline,
                    a.deadline
                );


            case "progress-asc":

                return (
                    (Number(a.progress) || 0) -
                    (Number(b.progress) || 0)
                );


            case "progress-desc":

                return (
                    (Number(b.progress) || 0) -
                    (Number(a.progress) || 0)
                );


            case "priority":

                return (
                    getPriorityValue(b.priority) -
                    getPriorityValue(a.priority)
                );


            default:

                return 0;
        }

    });


    // ===============================
    // NO PROJECTS AFTER FILTER
    // ===============================

    if (filteredProjects.length === 0) {

        container.innerHTML = `
            <div class="col-12">

                <div class="text-center py-5">

                    <h4>No projects found</h4>

                    <p class="text-muted">
                        Try changing your search or filters.
                    </p>

                </div>

            </div>
        `;

        updateProjectCount(0);

        return;
    }


    // ===============================
    // DISPLAY PROJECT CARDS
    // ===============================

    container.innerHTML =
        filteredProjects.map(function (project) {

            const projectId =
                String(project._id);

            const progress =
                Math.min(
                    100,
                    Math.max(
                        0,
                        Number(project.progress) || 0
                    )
                );

            const status =
                project.status || "In Progress";

            const priority =
                project.priority || "Medium";

            const overdue =
                isOverdue(project.deadline) &&
                status !== "Completed";


            return `
                <div class="col-md-6 col-lg-4 mb-4">

                    <div class="card h-100 shadow-sm">

                        <div class="card-body d-flex flex-column">

                            <div class="d-flex justify-content-between align-items-start mb-2">

                                <h5 class="card-title mb-0">
                                    ${escapeHTML(project.name)}
                                </h5>

                                <span class="badge bg-${getPriorityColor(priority)}">
                                    ${escapeHTML(priority)}
                                </span>

                            </div>


                            <span class="badge bg-${getStatusColor(status)} mb-3 align-self-start">
                                ${escapeHTML(status)}
                            </span>


                            <p class="text-muted">
                                ${escapeHTML(
                                    project.description ||
                                    "No description"
                                )}
                            </p>


                            <!-- Progress -->

                            <div class="mb-3">

                                <div class="d-flex justify-content-between">

                                    <small>
                                        Progress
                                    </small>

                                    <small>
                                        <strong>
                                            ${progress}%
                                        </strong>
                                    </small>

                                </div>


                                <div class="progress mt-1">

                                    <div
                                        class="progress-bar"
                                        role="progressbar"
                                        style="width: ${progress}%"
                                        aria-valuenow="${progress}"
                                        aria-valuemin="0"
                                        aria-valuemax="100">
                                    </div>

                                </div>

                            </div>


                            <!-- Dates -->

                            <div class="small text-muted mb-3">

                                <div class="mb-2">

                                    <strong>
                                        Start Date:
                                    </strong>

                                    ${
                                        project.start_date
                                            ? formatDate(
                                                project.start_date
                                            )
                                            : "Not set"
                                    }

                                </div>


                                <div class="${overdue ? "overdue" : ""}">

                                    <strong>
                                        Deadline:
                                    </strong>

                                    ${
                                        project.deadline
                                            ? formatDate(
                                                project.deadline
                                            )
                                            : "Not set"
                                    }

                                    ${
                                        overdue
                                            ? " ⚠ Overdue"
                                            : ""
                                    }

                                </div>

                            </div>


                            <!-- Buttons -->

                            <div class="d-flex gap-2 mt-auto">

                                <button
                                    type="button"
                                    class="btn btn-primary btn-sm"
                                    onclick="openEditProjectModal('${projectId}')">

                                    ✏️ Edit

                                </button>


                                <button
                                    type="button"
                                    class="btn btn-danger btn-sm"
                                    onclick="deleteProject('${projectId}')">

                                    🗑️ Delete

                                </button>

                            </div>

                        </div>

                    </div>

                </div>
            `;

        }).join("");


    // ===============================
    // RESULT COUNT
    // ===============================

    updateProjectCount(filteredProjects.length);
}

// ===============================
// STATISTICS
// ===============================

function updateStatistics() {

    const total =
        projects.length;

    const active =
        projects.filter(function (project) {
            return project.status === "In Progress";
        }).length;

    const completed =
        projects.filter(function (project) {
            return project.status === "Completed";
        }).length;

    const pending =
        projects.filter(function (project) {
            return project.status === "Pending";
        }).length;

    const highPriority =
        projects.filter(function (project) {
            return project.priority === "High";
        }).length;

    const mediumPriority =
        projects.filter(function (project) {
            return project.priority === "Medium";
        }).length;

    const lowPriority =
        projects.filter(function (project) {
            return project.priority === "Low";
        }).length;


    // ===============================
    // BASIC STATISTICS
    // ===============================

    const totalElement =
        document.getElementById("totalProjects");

    const activeElement =
        document.getElementById("activeProjects");

    const completedElement =
        document.getElementById("completedProjects");

    if (totalElement) {
        totalElement.textContent = total;
    }

    if (activeElement) {
        activeElement.textContent = active;
    }

    if (completedElement) {
        completedElement.textContent = completed;
    }


    // ===============================
    // AVERAGE PROGRESS
    // ===============================

    let averageProgress = 0;

    if (projects.length > 0) {

        const totalProgress =
            projects.reduce(function (sum, project) {

                return sum +
                    (Number(project.progress) || 0);

            }, 0);

        averageProgress =
            Math.round(
                totalProgress / projects.length
            );
    }

    const averageProgressElement =
        document.getElementById("averageProgress");

    if (averageProgressElement) {

        averageProgressElement.textContent =
            `${averageProgress}%`;
    }


    // ===============================
    // OVERDUE PROJECTS
    // ===============================

    const overdueCount =
        projects.filter(function (project) {

            return (
                project.status !== "Completed" &&
                isOverdue(project.deadline)
            );

        }).length;

    const overdueElement =
        document.getElementById("overdueProjects");

    if (overdueElement) {

        overdueElement.textContent =
            overdueCount;
    }


    // ===============================
    // STATUS CHART
    // ===============================
    // PROJECT DETAILS DASHBOARD

const completionRate =
    total > 0
        ? Math.round((completed / total) * 100)
        : 0;

const completionRateElement =
    document.getElementById("completionRate");

if (completionRateElement) {
    completionRateElement.textContent =
        `${completionRate}%`;
}

const highPriorityElement =
    document.getElementById("highPriorityCount");

if (highPriorityElement) {
    highPriorityElement.textContent =
        highPriority;
}

const dashboardAverageElement =
    document.getElementById("dashboardAverageProgress");

if (dashboardAverageElement) {
    dashboardAverageElement.textContent =
        `${averageProgress}%`;
}

const dashboardOverdueElement =
    document.getElementById("dashboardOverdue");

if (dashboardOverdueElement) {
    dashboardOverdueElement.textContent =
        overdueCount;
}

    createStatusChart(
        active,
        pending,
        completed
    );


    // ===============================
    // PRIORITY CHART
    // ===============================

    createPriorityChart(
        highPriority,
        mediumPriority,
        lowPriority
    );
    showDeadlineAlerts();
}

// ===============================
// STATUS CHART
// ===============================

function createStatusChart(
    active,
    pending,
    completed
) {

    const canvas =
        document.getElementById("statusChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart =
        new Chart(canvas, {

            type: "doughnut",

            data: {

                labels: [
                    "In Progress",
                    "Pending",
                    "Completed"
                ],

                datasets: [{
                    data: [
                        active,
                        pending,
                        completed
                    ]
                }]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        position: "bottom"
                    }

                }

            }

        });
}


// ===============================
// PRIORITY CHART
// ===============================

function createPriorityChart(
    high,
    medium,
    low
) {

    const canvas =
        document.getElementById("priorityChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    if (priorityChart) {
        priorityChart.destroy();
    }

    priorityChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: [
                    "High",
                    "Medium",
                    "Low"
                ],

                datasets: [{

                    label: "Projects",

                    data: [
                        high,
                        medium,
                        low
                    ]

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }

                    }

                },

                plugins: {

                    legend: {
                        display: false
                    }

                }

            }

        });
}

function updateProjectCount(count) 
{

    const element =
        document.getElementById("projectCount");

    if (element) {
        element.textContent =
            `${count} project${count === 1 ? "" : "s"}`;
    }
}

// ===============================
// ADD PROJECT MODAL
// ===============================

function openAddProjectModal() {

    const form =
        document.getElementById("projectForm");

    if (form) {
        form.reset();
    }

    document.getElementById("projectId").value = "";

    document.getElementById("projectStatus").value =
        "In Progress";

    document.getElementById("projectPriority").value =
        "Medium";

    document.getElementById("projectProgress").value =
        0;

    document.getElementById("progressValue").textContent =
        "0%";

    // Correct ID from index.html
    const title =
        document.getElementById("modalTitle");

    if (title) {
        title.textContent = "Add Project";
    }

    const modalElement =
        document.getElementById("projectModal");

    if (modalElement) {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement
            );

        modal.show();
    }
}

// ===============================
// EDIT PROJECT MODAL
// ===============================

function openEditProjectModal(id) {

    const project =
        projects.find(function (p) {
            return String(p._id) === String(id);
        });

    if (!project) {
        alert("Project not found.");
        return;
    }

    console.log("Editing project:", project);

    document.getElementById("projectId").value =
        project._id;

    document.getElementById("projectName").value =
        project.name || "";

    document.getElementById("projectStatus").value =
        project.status || "In Progress";

    document.getElementById("projectPriority").value =
        project.priority || "Medium";

    document.getElementById("projectStartDate").value =
        project.start_date || "";

    document.getElementById("projectDeadline").value =
        project.deadline || "";

    document.getElementById("projectProgress").value =
        Number(project.progress) || 0;

    document.getElementById("projectDescription").value =
        project.description || "";

    const progress =
        Number(project.progress) || 0;

    document.getElementById("progressValue").textContent =
        `${progress}%`;

    // Correct ID from index.html
    const title =
        document.getElementById("modalTitle");

    if (title) {
        title.textContent = "Edit Project";
    }

    const modalElement =
        document.getElementById("projectModal");

    if (modalElement) {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement
            );

        modal.show();
    }
}

// ===============================
// SAVE PROJECT
// ===============================

async function saveProject() {

    const id =
        document.getElementById("projectId").value.trim();

    const name =
        document.getElementById("projectName").value.trim();

    const status =
        document.getElementById("projectStatus").value;

    const priority =
        document.getElementById("projectPriority").value;

    const progress =
        Number(
            document.getElementById("projectProgress").value
        ) || 0;

    const start_date =
        document.getElementById("projectStartDate").value;

    const deadline =
        document.getElementById("projectDeadline").value;

    const description =
        document.getElementById("projectDescription").value.trim();

    if (!name) {
        alert("Please enter project name.");
        return;
    }

    const projectData = {
        name,
        status,
        priority,
        progress,
        start_date,
        deadline,
        description
    };

    console.log(
        id ? "Updating project:" : "Creating project:",
        JSON.stringify(projectData, null, 2)
    );

    try {

        let url = API_URL;
        let method = "POST";

        if (id) {
            url = `${API_URL}/${id}`;
            method = "PUT";
        }

        const response =
            await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: JSON.stringify(projectData)
            });

        const result =
            await response.json();

        console.log("Save response:", result);

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                logout();
                return;
            }

            throw new Error(
                result.message ||
                "Failed to save project"
            );
        }

        alert(
            result.message ||
            (id
                ? "Project updated successfully"
                : "Project created successfully")
        );

        closeProjectModal();

        await loadProjects();

    } catch (error) {

        console.error(
            "Save project error:",
            error
        );

        alert(
            `Failed to save project: ${error.message}`
        );
    }
}

// ===============================
// CLOSE PROJECT MODAL
// ===============================

function closeProjectModal() {

    const modalElement =
        document.getElementById("projectModal");

    if (!modalElement) {
        return;
    }

    const modal =
        bootstrap.Modal.getInstance(
            modalElement
        );

    if (modal) {
        modal.hide();
    }
}

// ===============================
// DELETE PROJECT
// ===============================

async function deleteProject(id) {

    const project =
        projects.find(function (p) {
            return String(p._id) === String(id);
        });

    const projectName =
        project?.name || "this project";

    const confirmed =
        confirm(
            `Are you sure you want to delete "${projectName}"?`
        );

    if (!confirmed) {
        return;
    }

    try {

        console.log("Deleting project:", id);

        const response =
            await fetch(
                `${API_URL}/${id}`,
                {
                    method: "DELETE",
                    headers: getAuthHeaders()
                }
            );

        const result =
            await response.json();

        console.log("Delete response:", result);

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                logout();
                return;
            }

            throw new Error(
                result.message ||
                "Failed to delete project"
            );
        }

        alert(
            result.message ||
            "Project deleted successfully"
        );

        await loadProjects();

    } catch (error) {

        console.error(
            "Delete project error:",
            error
        );

        alert(
            `Failed to delete project: ${error.message}`
        );
    }
}

// ===============================
// TASK MANAGEMENT
// ===============================

let editingTaskId = null;


// ===============================
// LOAD TASKS
// ===============================

async function loadTasks() {

    if (!checkLogin()) {
        return;
    }

    try {

        const search =
            document.getElementById("taskSearchInput")?.value.trim() || "";

        const status =
            document.getElementById("taskStatusFilter")?.value || "";

        const priority =
            document.getElementById("taskPriorityFilter")?.value || "";

        const projectId =
            document.getElementById("taskProjectFilter")?.value || "";

        const params =
            new URLSearchParams();

        if (search) {
            params.append("search", search);
        }

        if (status) {
            params.append("status", status);
        }

        if (priority) {
            params.append("priority", priority);
        }

        if (projectId) {
            params.append("projectId", projectId);
        }

        const queryString =
            params.toString()
                ? `?${params.toString()}`
                : "";

        const response =
            await fetch(
                `${TASK_API_URL}${queryString}`,
                {
                    method: "GET",
                    headers: getAuthHeaders()
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                logout();
                return;
            }

            throw new Error(
                data.message ||
                "Failed to load tasks"
            );
        }

        tasks =
            Array.isArray(data)
                ? data
                : [];

        console.log(
            "Tasks loaded:",
            tasks
        );

        displayTasks();
        updateTaskStatistics();

    } catch (error) {

        console.error(
            "Load tasks error:",
            error
        );

        const container =
            document.getElementById(
                "taskContainer"
            );

        if (container) {

            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        Failed to load tasks.
                        ${escapeHTML(error.message)}
                    </div>
                </div>
            `;
        }
    }
}


// ===============================
// DISPLAY TASKS
// ===============================

function displayTasks() {

    const container =
        document.getElementById(
            "taskContainer"
        );

    if (!container) {
        return;
    }

    if (tasks.length === 0) {

        container.innerHTML = `
            <div class="col-12">

                <div class="text-center py-5">

                    <h4>No tasks found</h4>

                    <p class="text-muted">
                        Create your first task to get started.
                    </p>

                </div>

            </div>
        `;

        return;
    }


    container.innerHTML =
        tasks.map(function (task) {

            const taskId =
                String(task._id);

            const progress =
                Math.min(
                    100,
                    Math.max(
                        0,
                        Number(task.progress) || 0
                    )
                );

            const status =
                task.status || "Todo";

            const priority =
                task.priority || "Medium";

            const project =
                projects.find(function (p) {
                    return String(p._id) ===
                        String(task.projectId);
                });

            const projectName =
                project?.name ||
                "Unknown Project";

            const overdue =
                task.dueDate &&
                status !== "Completed" &&
                isOverdue(task.dueDate);

            return `
                <div class="col-md-6 col-xl-4 mb-4">

                    <div class="card h-100 shadow-sm">

                        <div class="card-body d-flex flex-column">

                            <div class="d-flex
                                        justify-content-between
                                        align-items-start
                                        mb-2">

                                <h5 class="card-title mb-0">
                                    ${escapeHTML(task.name)}
                                </h5>

                                <span class="badge
                                             bg-${getPriorityColor(priority)}">

                                    ${escapeHTML(priority)}

                                </span>

                            </div>


                            <span class="badge
                                         bg-${getTaskStatusColor(status)}
                                         align-self-start
                                         mb-3">

                                ${escapeHTML(status)}

                            </span>


                            <p class="text-muted">

                                ${escapeHTML(
                                    task.description ||
                                    "No description"
                                )}

                            </p>


                            <div class="small mb-3">

                                <div class="mb-2">

                                    <strong>Project:</strong>

                                    ${escapeHTML(
                                        projectName
                                    )}

                                </div>


                                <div class="mb-2">

                                    <strong>Due Date:</strong>

                                    <span class="${
                                        overdue
                                            ? "text-danger fw-bold"
                                            : ""
                                    }">

                                        ${
                                            task.dueDate
                                                ? formatDate(
                                                    task.dueDate
                                                )
                                                : "Not set"
                                        }

                                        ${
                                            overdue
                                                ? " ⚠ Overdue"
                                                : ""
                                        }

                                    </span>

                                </div>

                            </div>


                            <!-- PROGRESS -->

                            <div class="mb-3">

                                <div class="d-flex
                                            justify-content-between">

                                    <small>
                                        Progress
                                    </small>

                                    <small>
                                        <strong>
                                            ${progress}%
                                        </strong>
                                    </small>

                                </div>


                                <div class="progress mt-1">

                                    <div
                                        class="progress-bar"
                                        role="progressbar"
                                        style="width: ${progress}%"
                                        aria-valuenow="${progress}"
                                        aria-valuemin="0"
                                        aria-valuemax="100">

                                    </div>

                                </div>

                            </div>


                            <!-- BUTTONS -->

                            <div class="d-flex
                                        gap-2
                                        mt-auto">

                                <button
                                    type="button"
                                    class="btn btn-primary btn-sm"
                                    onclick="openEditTaskModal('${taskId}')">

                                    ✏️ Edit

                                </button>


                                <button
                                    type="button"
                                    class="btn btn-danger btn-sm"
                                    onclick="deleteTask('${taskId}')">

                                    🗑️ Delete

                                </button>

                            </div>

                        </div>

                    </div>

                </div>
            `;

        }).join("");
}


// ===============================
// TASK STATUS COLOR
// ===============================

function getTaskStatusColor(status) {

    switch (status) {

        case "Completed":
            return "success";

        case "In Progress":
            return "primary";

        case "Todo":
            return "secondary";

        default:
            return "secondary";
    }
}


// ===============================
// OPEN ADD TASK MODAL
// ===============================

function openAddTaskModal() {

    editingTaskId = null;

    const form =
        document.getElementById(
            "taskForm"
        );

    if (form) {
        form.reset();
    }


    const taskId =
        document.getElementById(
            "taskId"
        );

    if (taskId) {
        taskId.value = "";
    }


    const status =
        document.getElementById(
            "taskStatus"
        );

    if (status) {
        status.value = "Todo";
    }


    const priority =
        document.getElementById(
            "taskPriority"
        );

    if (priority) {
        priority.value = "Medium";
    }


    const progress =
        document.getElementById(
            "taskProgress"
        );

    if (progress) {
        progress.value = 0;
    }


    const progressValue =
        document.getElementById(
            "taskProgressValue"
        );

    if (progressValue) {
        progressValue.textContent = "0%";
    }


    const title =
        document.getElementById(
            "taskModalTitle"
        );

    if (title) {
        title.textContent = "Add Task";
    }


    loadTaskProjectOptions();


    const modalElement =
        document.getElementById(
            "taskModal"
        );

    if (modalElement) {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement
            );

        modal.show();
    }
}


// ===============================
// LOAD PROJECT OPTIONS
// ===============================

function loadTaskProjectOptions() {

    const projectSelect =
        document.getElementById(
            "taskProject"
        );

    if (!projectSelect) {
        return;
    }

    projectSelect.innerHTML =
        `<option value="">Select Project</option>`;


    projects.forEach(function (project) {

        projectSelect.innerHTML += `
            <option value="${project._id}">
                ${escapeHTML(project.name)}
            </option>
        `;

    });
}


// ===============================
// EDIT TASK
// ===============================

function openEditTaskModal(id) {

    const task =
        tasks.find(function (t) {

            return String(t._id) ===
                String(id);

        });

    if (!task) {

        alert("Task not found.");

        return;
    }

    editingTaskId =
        String(task._id);


    loadTaskProjectOptions();


    document.getElementById(
        "taskId"
    ).value =
        task._id;


    document.getElementById(
        "taskName"
    ).value =
        task.name || "";


    document.getElementById(
        "taskDescription"
    ).value =
        task.description || "";


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
        "taskProgress"
    ).value =
        Number(task.progress) || 0;


    document.getElementById(
        "taskDueDate"
    ).value =
        task.dueDate || "";


    const progressValue =
        document.getElementById(
            "taskProgressValue"
        );

    if (progressValue) {

        progressValue.textContent =
            `${Number(task.progress) || 0}%`;

    }


    const title =
        document.getElementById(
            "taskModalTitle"
        );

    if (title) {

        title.textContent =
            "Edit Task";

    }


    const modalElement =
        document.getElementById(
            "taskModal"
        );

    if (modalElement) {

        const modal =
            bootstrap.Modal.getOrCreateInstance(
                modalElement
            );

        modal.show();
    }
}


// ===============================
// SAVE TASK
// ===============================

async function saveTask() {

    const id =
        document.getElementById(
            "taskId"
        )?.value.trim();


    const name =
        document.getElementById(
            "taskName"
        )?.value.trim();


    const description =
        document.getElementById(
            "taskDescription"
        )?.value.trim();


    const projectId =
        document.getElementById(
            "taskProject"
        )?.value;


    const status =
        document.getElementById(
            "taskStatus"
        )?.value;


    const priority =
        document.getElementById(
            "taskPriority"
        )?.value;


    const progress =
        Number(
            document.getElementById(
                "taskProgress"
            )?.value
        ) || 0;


    const dueDate =
        document.getElementById(
            "taskDueDate"
        )?.value;


    if (!name) {

        alert("Please enter task name.");

        return;
    }


    if (!projectId) {

        alert("Please select a project.");

        return;
    }


    const taskData = {

        name,

        description,

        projectId,

        status,

        priority,

        progress,

        dueDate

    };


    try {

        let url =
            TASK_API_URL;

        let method =
            "POST";


        if (id) {

            url =
                `${TASK_API_URL}/${id}`;

            method =
                "PUT";
        }


        const response =
            await fetch(
                url,
                {
                    method,
                    headers:
                        getAuthHeaders(),

                    body:
                        JSON.stringify(
                            taskData
                        )
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                logout();

                return;
            }

            throw new Error(
                result.message ||
                "Failed to save task"
            );
        }


        alert(
            result.message ||
            (
                id
                    ? "Task updated successfully"
                    : "Task created successfully"
            )
        );


        closeTaskModal();


        await loadTasks();

    } catch (error) {

        console.error(
            "Save task error:",
            error
        );

        alert(
            `Failed to save task: ${error.message}`
        );
    }
}


// ===============================
// CLOSE TASK MODAL
// ===============================

function closeTaskModal() {

    const modalElement =
        document.getElementById(
            "taskModal"
        );

    if (!modalElement) {
        return;
    }


    const modal =
        bootstrap.Modal.getInstance(
            modalElement
        );


    if (modal) {
        modal.hide();
    }
}


// ===============================
// DELETE TASK
// ===============================

async function deleteTask(id) {

    const task =
        tasks.find(function (t) {

            return String(t._id) ===
                String(id);

        });


    const taskName =
        task?.name ||
        "this task";


    const confirmed =
        confirm(
            `Are you sure you want to delete "${taskName}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${TASK_API_URL}/${id}`,
                {
                    method: "DELETE",
                    headers:
                        getAuthHeaders()
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                logout();

                return;
            }

            throw new Error(
                result.message ||
                "Failed to delete task"
            );
        }


        alert(
            result.message ||
            "Task deleted successfully"
        );


        await loadTasks();

    } catch (error) {

        console.error(
            "Delete task error:",
            error
        );

        alert(
            `Failed to delete task: ${error.message}`
        );
    }
}


// ===============================
// TASK STATISTICS
// ===============================

function updateTaskStatistics() {

    const total =
        tasks.length;


    const todo =
        tasks.filter(function (task) {

            return task.status === "Todo";

        }).length;


    const inProgress =
        tasks.filter(function (task) {

            return task.status === "In Progress";

        }).length;


    const completed =
        tasks.filter(function (task) {

            return task.status === "Completed";

        }).length;


    const highPriority =
        tasks.filter(function (task) {

            return task.priority === "High";

        }).length;


    const overdue =
        tasks.filter(function (task) {

            return (
                task.status !== "Completed" &&
                isOverdue(task.dueDate)
            );

        }).length;


    setElementText(
        "totalTasks",
        total
    );

    setElementText(
        "todoTasks",
        todo
    );

    setElementText(
        "inProgressTasks",
        inProgress
    );

    setElementText(
        "completedTasks",
        completed
    );

    setElementText(
        "highPriorityTasks",
        highPriority
    );

    setElementText(
        "overdueTasks",
        overdue
    );
    updateDashboardTaskAnalytics();
}
// ===============================
// PHASE 2 DASHBOARD ANALYTICS
// ===============================

function updateDashboardTaskAnalytics() {

    const totalTasks = tasks.length;

    const completedTasks =
        tasks.filter(function (task) {
            return task.status === "Completed";
        }).length;

    const todoTasks =
        tasks.filter(function (task) {
            return task.status === "Todo";
        }).length;

    const inProgressTasks =
        tasks.filter(function (task) {
            return task.status === "In Progress";
        }).length;

    const pendingTasks =
        todoTasks + inProgressTasks;

    const highPriorityTasks =
        tasks.filter(function (task) {
            return task.priority === "High";
        }).length;

    const mediumPriorityTasks =
        tasks.filter(function (task) {
            return task.priority === "Medium";
        }).length;

    const lowPriorityTasks =
        tasks.filter(function (task) {
            return task.priority === "Low";
        }).length;

    const overdueTasks =
        tasks.filter(function (task) {

            return (
                task.status !== "Completed" &&
                isOverdue(task.dueDate)
            );

        }).length;


    // ===============================
    // TASK COMPLETION PERCENTAGE
    // ===============================

    const completionPercentage =
        totalTasks > 0
            ? Math.round(
                (completedTasks / totalTasks) * 100
            )
            : 0;


    // ===============================
    // UPDATE CARDS
    // ===============================

    setElementText(
        "dashboardTotalTasks",
        totalTasks
    );

    setElementText(
        "dashboardCompletedTasks",
        completedTasks
    );

    setElementText(
        "dashboardPendingTasks",
        pendingTasks
    );

    setElementText(
        "dashboardTaskCompletion",
        `${completionPercentage}%`
    );


    // ===============================
    // TASK SUMMARY
    // ===============================

    setElementText(
        "dashboardTodoTasks",
        todoTasks
    );

    setElementText(
        "dashboardInProgressTasks",
        inProgressTasks
    );

    setElementText(
        "dashboardHighPriorityTasks",
        highPriorityTasks
    );

    setElementText(
        "dashboardOverdueTasks",
        overdueTasks
    );


    // ===============================
    // CREATE CHARTS
    // ===============================

    createProjectProgressChart();

    createTaskStatusChart(
        todoTasks,
        inProgressTasks,
        completedTasks
    );

    createTaskPriorityChart(
        highPriorityTasks,
        mediumPriorityTasks,
        lowPriorityTasks
    );
}
// ===============================
// PROJECT PROGRESS CHART
// ===============================

function createProjectProgressChart() {

    const canvas =
        document.getElementById(
            "projectProgressChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    if (projectProgressChart) {
        projectProgressChart.destroy();
    }

    const labels =
        projects.map(function (project) {
            return project.name || "Unnamed";
        });

    const progressData =
        projects.map(function (project) {

            return Math.min(
                100,
                Math.max(
                    0,
                    Number(project.progress) || 0
                )
            );

        });


    projectProgressChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: labels,

                datasets: [{

                    label: "Progress (%)",

                    data: progressData

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {

                        beginAtZero: true,

                        max: 100,

                        ticks: {

                            callback: function (value) {
                                return value + "%";
                            }

                        }

                    }

                },

                plugins: {

                    legend: {
                        display: false
                    }

                }

            }

        });
}
// ======================================================
// TASK STATUS CHART
// ======================================================

function createTaskStatusChart(todo, inProgress, completed) {

    const canvas = document.getElementById("taskStatusChart");

    if (!canvas) return;

    if (taskStatusChart) {
        taskStatusChart.destroy();
    }

    taskStatusChart = new Chart(canvas, {

        type: "doughnut",

        data: {
            labels: [
                "Todo",
                "In Progress",
                "Completed"
            ],

            datasets: [{
                data: [
                    todo,
                    inProgress,
                    completed
                ]
            }]
        },

        options: {
            responsive: true,

            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

// ===============================
// TASK PRIORITY CHART
// ===============================

function createTaskPriorityChart(
    high,
    medium,
    low
) {

    const canvas =
        document.getElementById(
            "taskPriorityChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    if (taskPriorityChart) {
        taskPriorityChart.destroy();
    }

    taskPriorityChart =
        new Chart(canvas, {

            type: "bar",

            data: {

                labels: [
                    "High",
                    "Medium",
                    "Low"
                ],

                datasets: [{

                    label: "Tasks",

                    data: [
                        high,
                        medium,
                        low
                    ]

                }]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {

                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }

                    }

                },

                plugins: {

                    legend: {
                        display: false
                    }

                }

            }

        });
}

// ===============================
// HELPER
// ===============================

function setElementText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


// ===============================
// CLEAR TASK FILTERS
// ===============================

function clearTaskFilters() {

    const search =
        document.getElementById(
            "taskSearchInput"
        );

    const status =
        document.getElementById(
            "taskStatusFilter"
        );

    const priority =
        document.getElementById(
            "taskPriorityFilter"
        );

    const project =
        document.getElementById(
            "taskProjectFilter"
        );


    if (search) {
        search.value = "";
    }

    if (status) {
        status.value = "";
    }

    if (priority) {
        priority.value = "";
    }

    if (project) {
        project.value = "";
    }


    loadTasks();
} 
// ===============================
// CLEAR FILTERS
// ===============================

function clearFilters() 
{

    const search =
        document.getElementById("searchInput");

    const status =
        document.getElementById("statusFilter");

    const priority =
        document.getElementById("priorityFilter");

    if (search) {
        search.value = "";
    }

    if (status) {
        status.value = "";
    }

    if (priority) {
        priority.value = "";
    }

    loadProjects();
}
// EXPORT PROJECTS TO CSV
function exportProjectsCSV() {
    if (projects.length === 0) {
        alert("No projects available to export.");
        return;
    }

    const headers = [
        "Project Name",
        "Status",
        "Priority",
        "Progress",
        "Start Date",
        "Deadline",
        "Description"
    ];

    const rows = projects.map(function (project) {
        return [
            project.name || "",
            project.status || "",
            project.priority || "",
            `${Number(project.progress) || 0}%`,
            project.start_date || "",
            project.deadline || "",
            project.description || ""
        ];
    });

    function escapeCSV(value) {
        return `"${String(value).replace(/"/g, '""')}"`;
    }

    const csvContent = [
        headers,
        ...rows
    ]
        .map(function (row) {
            return row.map(escapeCSV).join(",");
        })
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csvContent],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "project-tracker-export.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    alert("Projects exported successfully!");
}

// ===============================
// FORMAT DATE
// ===============================

function formatDate(date) {

    if (!date) {
        return "";
    }

    const d =
        new Date(`${date}T00:00:00`);

    if (isNaN(d.getTime())) {
        return date;
    }

    return d.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}
// DEADLINE ALERTS
function showDeadlineAlerts() {
    const alertContainer =
        document.getElementById("deadlineAlerts");

    if (!alertContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts = [];

    projects.forEach(function (project) {
        if (!project.deadline) return;

        if (project.status === "Completed") return;

        const deadline =
            new Date(`${project.deadline}T00:00:00`);

        if (isNaN(deadline.getTime())) return;

        const difference =
            Math.ceil(
                (deadline - today) /
                (1000 * 60 * 60 * 24)
            );

        if (difference < 0) {
            alerts.push(`
                <div class="alert alert-danger">
                    🔴 <strong>Overdue:</strong>
                    ${escapeHTML(project.name)}
                    was due on
                    ${formatDate(project.deadline)}.
                </div>
            `);
        }
        else if (difference === 0) {
            alerts.push(`
                <div class="alert alert-warning">
                    ⚠️ <strong>Due Today:</strong>
                    ${escapeHTML(project.name)}
                    is due today.
                </div>
            `);
        }
        else if (difference <= 3) {
            alerts.push(`
                <div class="alert alert-warning">
                    ⏰ <strong>Deadline Approaching:</strong>
                    ${escapeHTML(project.name)}
                    is due in ${difference}
                    day${difference === 1 ? "" : "s"}.
                </div>
            `);
        }
    });

    if (alerts.length === 0) {
        alertContainer.innerHTML = `
            <div class="alert alert-success">
                ✅ No upcoming or overdue deadlines.
            </div>
        `;
    } else {
        alertContainer.innerHTML = `
            <h4 class="mb-3">🔔 Deadline Alerts</h4>
            ${alerts.join("")}
        `;
    }
}
// ===============================
// CHECK OVERDUE
// ===============================

function isOverdue(deadline) {

    if (!deadline) {
        return false;
    }

    const deadlineDate =
        new Date(`${deadline}T00:00:00`);

    if (isNaN(deadlineDate.getTime())) {
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

    return deadlineDate < today;
}

// ===============================
// STATUS COLOR
// ===============================

function getStatusColor(status) {

    switch (status) {

        case "Completed":
            return "success";

        case "Pending":
            return "warning";

        case "In Progress":
            return "primary";

        default:
            return "secondary";
    }
}

// ===============================
// PRIORITY COLOR
// ===============================

function getPriorityColor(priority) {

    switch (priority) {

        case "High":
            return "danger";

        case "Medium":
            return "warning";

        case "Low":
            return "success";

        default:
            return "secondary";
    }
}

// ===============================
// ESCAPE HTML
// ===============================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
// ===============================
// SORT HELPERS
// ===============================

function compareDates(dateA, dateB) {

    if (!dateA && !dateB) {
        return 0;
    }

    if (!dateA) {
        return 1;
    }

    if (!dateB) {
        return -1;
    }

    return new Date(`${dateA}T00:00:00`) -
           new Date(`${dateB}T00:00:00`);
}


function getPriorityValue(priority) {

    switch (priority) {

        case "High":
            return 3;

        case "Medium":
            return 2;

        case "Low":
            return 1;

        default:
            return 0;
    }
}
// ===============================
// PROJECT CALENDAR
// ===============================

function renderCalendar() {
    const calendarDays =
        document.getElementById("calendarDays");

    const calendarMonth =
        document.getElementById("calendarMonth");

    if (!calendarDays || !calendarMonth) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthName =
        calendarDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric"
        });

    calendarMonth.textContent = monthName;

    const firstDay =
        new Date(year, month, 1).getDay();

    const daysInMonth =
        new Date(year, month + 1, 0).getDate();

    let html = "";
    let day = 1;

    for (let week = 0; week < 6; week++) {

        html += "<tr>";

        for (let weekday = 0; weekday < 7; weekday++) {

            if (
                (week === 0 && weekday < firstDay) ||
                day > daysInMonth
            ) {
                html += `
                    <td style="height: 100px;"></td>
                `;
            } else {

                const currentDate =
                    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                const startProjects =
                    projects.filter(function (project) {
                        return project.start_date === currentDate;
                    });

                const deadlineProjects =
                    projects.filter(function (project) {
                        return project.deadline === currentDate;
                    });

                let events = "";

                startProjects.forEach(function (project) {
    events += `
        <div
            class="small bg-primary text-white rounded px-1 py-1 mb-1"
            style="cursor: pointer;"
            title="Edit ${escapeHTML(project.name)}"
            onclick="openEditProjectModal('${project._id}')">
            🚀 ${escapeHTML(project.name)}
        </div>
    `;
});

                deadlineProjects.forEach(function (project) {

    const badgeClass =
        project.status === "Completed"
            ? "bg-success"
            : "bg-danger";

    events += `
        <div
            class="small ${badgeClass} text-white rounded px-1 py-1 mb-1"
            style="cursor: pointer;"
            title="Edit ${escapeHTML(project.name)}"
            onclick="openEditProjectModal('${project._id}')">
            📌 ${escapeHTML(project.name)}
        </div>
    `;
});

                const today = new Date();

                const isToday =
                    day === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear();

                html += `
                    <td
                        style="height: 100px; vertical-align: top;"
                        class="${isToday ? "table-warning" : ""}">

                        <div class="fw-bold mb-2">
                            ${day}
                        </div>

                        ${events}

                    </td>
                `;

                day++;
            }
        }

        html += "</tr>";

        if (day > daysInMonth) {
            break;
        }
    }

    calendarDays.innerHTML = html;
}


// PREVIOUS / NEXT MONTH

function changeCalendarMonth(direction) {

    calendarDate.setMonth(
        calendarDate.getMonth() + direction
    );

    renderCalendar();
}
// ===============================
// DOM READY
// ===============================

document.addEventListener
(
    "DOMContentLoaded",
    function () 
    {

        console.log("DOM READY");

        if (!checkLogin()) {
            return;
        }

        loadUser();
        loadProjects();
        renderCalendar();

        // ===============================
        // PROJECT FORM
        // ===============================

        const projectForm =
            document.getElementById("projectForm");

        if (projectForm) {

            projectForm.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    saveProject();
                }
            );
            // ===============================
// TASK MANAGEMENT
// ===============================

loadTasks();


// TASK SEARCH

const taskSearchInput =
    document.getElementById(
        "taskSearchInput"
    );

if (taskSearchInput) {

    taskSearchInput.addEventListener(
        "input",
        function () {

            loadTasks();

        }
    );
}


// TASK STATUS FILTER

const taskStatusFilter =
    document.getElementById(
        "taskStatusFilter"
    );

if (taskStatusFilter) {

    taskStatusFilter.addEventListener(
        "change",
        function () {

            loadTasks();

        }
    );
}


// TASK PRIORITY FILTER

const taskPriorityFilter =
    document.getElementById(
        "taskPriorityFilter"
    );

if (taskPriorityFilter) {

    taskPriorityFilter.addEventListener(
        "change",
        function () {

            loadTasks();

        }
    );
}


// TASK PROJECT FILTER

const taskProjectFilter =
    document.getElementById(
        "taskProjectFilter"
    );

if (taskProjectFilter) {

    taskProjectFilter.addEventListener(
        "change",
        function () {

            loadTasks();

        }
    );
}


// TASK FORM

const taskForm =
    document.getElementById(
        "taskForm"
    );

if (taskForm) {

    taskForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            saveTask();

        }
    );
}


// TASK PROGRESS SLIDER

const taskProgress =
    document.getElementById(
        "taskProgress"
    );

const taskProgressValue =
    document.getElementById(
        "taskProgressValue"
    );

if (
    taskProgress &&
    taskProgressValue
) {

    taskProgress.addEventListener(
        "input",
        function () {

            taskProgressValue.textContent =
                `${this.value}%`;

        }
    );
}
        }
        // CONNECT CHANGE PASSWORD FORM

const changePasswordForm =
    document.getElementById("changePasswordForm");

if (changePasswordForm) {

    changePasswordForm.addEventListener(
        "submit",
        changePassword
    );

}

        // ===============================
        // PROGRESS SLIDER
        // ===============================

        const progressInput =
            document.getElementById("projectProgress");

        const progressValue =
            document.getElementById("progressValue");

        if (
            progressInput &&
            progressValue
        ) {

            progressInput.addEventListener(
                "input",
                function () {

                    progressValue.textContent =
                        `${this.value}%`;
                }
            );
        }

        // ===============================
        // SEARCH
        // ===============================

        const searchInput =
            document.getElementById("searchInput");

        if (searchInput) {

            searchInput.addEventListener(
                "input",
                function () {
                    displayProjects();
                }
            );
        }

        // ===============================
        // STATUS FILTER
        // ===============================

        const statusFilter =
            document.getElementById("statusFilter");

        if (statusFilter) {

            statusFilter.addEventListener(
                "change",
                function () {
                    displayProjects();
                }
            );
        }

        // ===============================
        // PRIORITY FILTER
        // ===============================

        const priorityFilter =
            document.getElementById("priorityFilter");

        if (priorityFilter) {

            priorityFilter.addEventListener(
                "change",
                function () {
                    displayProjects();
                }
            );
        }
        const sortFilter =
    document.getElementById("sortFilter");

if (sortFilter) {
    sortFilter.addEventListener(
        "change",
        function () {
            displayProjects();
        }
    );
}

    }
);