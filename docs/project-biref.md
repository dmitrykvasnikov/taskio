# Project description
Taskio is a small task management system with supports task dependecies, user management, user communication.

## Entities

###  Task
	'Task' is a small description of task to do. 
	Task has following properties (i mark it as optional in case if they could be missed):
		* Task description
		* Task owner - current user by default but it could be distributed between other users / groups (more about it below)
		* Task status, so far there 3 hardcoded status: 'waiting', 'in progress', 'done'. By default new task has 'waiting' status
		* Task deadline <optional>
		* Task tags <optional>. Tags are user defined, probably we will keep set of commonly used tags between users and share in on application level. Now each user create it's own tag cloud.
		* Task dependencies <optional>. Dependecy means that task could either 'depend on' other task (which means that the other task nust be executed BEFORE), or 'required by' other task (which means this task shoudl be done BEFORE the other task). syclic dependecies are not allowed.
		* Tasks could be listed in tree view so user can see task dependecies

### User 
	'User' is a user of allpication. User have login / password, login is user's email, but there are no email confirmation so far. But we need to check user email address to ba valid
	User has a nickname. 
	Nickname | email must be unique for application 
	Users can invite each other by email | nickname. When user get an invitation it could confirm or decline it. When invitation is confirmed users becomes taskbuddies.
	Users can communicate with each other with own single message chat system. Users have 'inbox' and 'outbox' messages.
	User can assign task to taskbuddie. After it taskbuddie get notification in inbox and can see this task in list of his task. When user assign task to taskbuddie and this task has dependecies it's up to user to decide if he want to share whole tree or only specific task.
	
## Implementation stack
	I have in mind implementation with React + TypeScript + Vite. Exact database layer is for discussion, but it should be some of SQL decision. Development will be build locally to check on localhost, but i have dedicated server with fresh Debian installed on it (new system, only root user and ssh daemon running so far), we need to establish communication with this server and make deploy workflow. I think that you should build some docker environment on this server and have a script here to push all necessary files to server. 
	As version control we will use git, do not work with remote server, i will do it myself. You do only local commits.
