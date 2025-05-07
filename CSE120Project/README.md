# How to run the magical LLM Code

There should be two folders in the project. `frontend` and `backend`. You will need two terminal windows or two terminal tabs.

## Running the backend
Start by running `cd backend` to enter the backend folder.

> If this is your first time running the backend (or you deleted the `node_modules`) folder, run the following command.

```nodejs
npm install
```

Also please create a `.env` file where you add ```
VITE_REDIRECT_URI=http://localhost:5173
```

This will install the dependencies to run the backend and update the dependincies. Then run `node server.js` to start the backend server.

## Running the front end
**DO NOT TERMINATE/CLOSE THE TERMINAL RUNNING THE BACKEND** Open a new one instead. Run `cd ..` to go back to the project root. Then run `cd frontend` to enter the frontend folder.

> If this is your first time running the backend (or you deleted the `node_modules`) folder, run the following command.

```nodejs
npm install
```

This will install the dependencies to run the frontend. Then run `npm run dev` to start the backend server.