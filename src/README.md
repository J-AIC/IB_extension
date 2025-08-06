# InsightBuddy Architecture Implementation

This directory contains the implementation of the Model-View-Controller (MVC) and Model-View-ViewModel (MVVM) architecture patterns for the InsightBuddy Chrome extension.

## Directory Structure

```
src/
├── architecture.js       # Base classes and interfaces for MVC/MVVM patterns
├── main.js               # Application entry point
├── models/               # Data models
│   └── ChatModel.js      # Chat data model
├── views/                # UI components
│   └── ChatView.js       # Chat UI view
├── controllers/          # Business logic
│   └── ChatController.js # Chat controller
├── services/             # Shared services
│   ├── ApiService.js     # API communication service
│   └── StorageService.js # Storage service
└── utils/                # Utility functions
```

## Getting Started

### Initializing the Application

To initialize the application, import and call the `initializeApp` function from `main.js`:

```javascript
import { initializeApp } from './src/main.js';

// Initialize the application
initializeApp();
```

### Using the Architecture

#### Models

Models represent the data and business logic of the application. They extend the base `Model` class from `architecture.js`.

```javascript
import { Model } from './architecture.js';

class MyModel extends Model {
    constructor(data = {}) {
        super(data);
    }

    // Add custom methods here
}
```

#### Views

Views represent the UI components of the application. They extend the base `View` class from `architecture.js`.

```javascript
import { View } from './architecture.js';

class MyView extends View {
    constructor(element, model) {
        super(element, model);
    }

    // Override render method
    render() {
        // Update the DOM based on the model state
        return this;
    }
}
```

#### Controllers

Controllers handle user interactions and business logic. They extend the base `Controller` class from `architecture.js`.

```javascript
import { Controller } from './architecture.js';

class MyController extends Controller {
    constructor(model, view) {
        super(model, view);
    }

    // Override handleAction method
    handleAction(action, data) {
        switch (action) {
            case 'doSomething':
                // Handle the action
                break;
        }
    }
}
```

#### ViewModels (MVVM)

ViewModels transform model data for the view and handle view-specific logic. They extend the base `ViewModel` class from `architecture.js`.

```javascript
import { ViewModel } from './architecture.js';

class MyViewModel extends ViewModel {
    constructor(model) {
        super(model);
    }

    // Add computed properties and view-specific logic
}
```

### Dependency Injection

The architecture uses a dependency injection container to manage dependencies. Services are registered in the container and can be retrieved when needed.

```javascript
import { container } from './architecture.js';

// Register a service
container.register('myService', (container) => {
    return new MyService();
}, true); // true = singleton

// Get a service
const myService = container.get('myService');
```

### Event Bus

The architecture uses an event bus for cross-component communication. Components can publish and subscribe to events.

```javascript
import { eventBus } from './architecture.js';

// Subscribe to an event
eventBus.on('myEvent', (data) => {
    console.log('Event received:', data);
});

// Publish an event
eventBus.emit('myEvent', { foo: 'bar' });
```

### State Management

The architecture includes a centralized state management system similar to Redux or Vuex. This system is defined in `stateManagement.js`.

#### Store

The store is the central piece of the state management system. It holds the application state and provides methods for state manipulation.

```javascript
import { createStore, createAction, createReducer } from './stateManagement.js';

// Create a store
const store = createStore({
    initialState: { count: 0 },
    rootReducer: (state, action) => {
        if (action.type === 'INCREMENT') {
            return { ...state, count: state.count + 1 };
        }
        return state;
    }
});

// Get the current state
const state = store.getState();

// Dispatch an action
store.dispatch({ type: 'INCREMENT' });
```

#### Actions and Reducers

Actions describe what happened, and reducers specify how the state changes in response.

```javascript
// Define action types
const ActionTypes = {
    INCREMENT: 'counter/INCREMENT',
    DECREMENT: 'counter/DECREMENT'
};

// Create action creators
const increment = createAction(ActionTypes.INCREMENT);
const decrement = createAction(ActionTypes.DECREMENT);

// Define a reducer
const counterReducer = createReducer({ count: 0 }, {
    [ActionTypes.INCREMENT]: (state, action) => ({
        ...state,
        count: state.count + (action.payload || 1)
    }),
    [ActionTypes.DECREMENT]: (state, action) => ({
        ...state,
        count: state.count - (action.payload || 1)
    })
});

// Dispatch actions
store.dispatch(increment());
store.dispatch(increment(5));
store.dispatch(decrement());
```

#### Combined Reducers

For complex applications, you can organize your state into domains using combined reducers.

```javascript
import { combineReducers } from './stateManagement.js';

// Define domain-specific reducers
const settingsReducer = createReducer(initialSettingsState, { /* ... */ });
const chatReducer = createReducer(initialChatState, { /* ... */ });
const uiReducer = createReducer(initialUiState, { /* ... */ });

// Combine reducers
const rootReducer = combineReducers({
    settings: settingsReducer,
    chat: chatReducer,
    ui: uiReducer
});

// Create store with combined reducer
const store = createStore({ rootReducer });
```

#### Middleware

Middleware provides a way to extend the store with custom functionality, such as logging or handling async actions.

```javascript
import { thunkMiddleware, loggerMiddleware } from './stateManagement.js';

// Create store with middleware
const store = createStore({
    rootReducer,
    middleware: [thunkMiddleware, loggerMiddleware]
});

// Define an async action creator (thunk)
const fetchData = () => async (dispatch, getState) => {
    dispatch({ type: 'FETCH_START' });
    try {
        const data = await api.getData();
        dispatch({ type: 'FETCH_SUCCESS', payload: data });
    } catch (error) {
        dispatch({ type: 'FETCH_ERROR', payload: error });
    }
};

// Dispatch async action
store.dispatch(fetchData());
```

#### State Subscriptions

You can subscribe to state changes to react to state updates.

```javascript
// Subscribe to all state changes
const unsubscribe = store.subscribe(() => {
    console.log('State changed:', store.getState());
});

// Subscribe to specific path changes
const unsubscribeTheme = store.subscribeToPath('ui.theme', (state) => {
    console.log('Theme changed to:', state.ui.theme);
    document.body.className = state.ui.theme;
});

// Unsubscribe when no longer needed
unsubscribe();
unsubscribeTheme();
```

#### Selectors

Selectors provide a way to extract and compute derived data from the state.

```javascript
import { createSelector } from './stateManagement.js';

// Create selectors
const getCount = createSelector(state => state.count);
const getDoubleCount = createSelector(state => state.count * 2);

// Use selectors
const count = getCount(store.getState());
const doubleCount = getDoubleCount(store.getState());
```

#### State Persistence

The store supports persisting and rehydrating state, which is useful for saving user preferences or application state.

```javascript
// Persist state
await store.persist({
    key: 'app_state',
    storage: chrome.storage.local,
    filter: (state) => {
        // Don't persist sensitive data
        const { auth, ...rest } = state;
        return rest;
    }
});

// Hydrate state
await store.hydrate({
    key: 'app_state',
    storage: chrome.storage.local,
    merge: true
});
```

#### Example Implementation

For a complete example of how to use the state management system, see the `examples/stateExample.js` file.

## Example Implementation

The example implementation includes a chat feature with the following components:

- **ChatModel**: Manages chat messages and state
- **ChatView**: Renders chat messages and handles user input
- **ChatController**: Processes user actions and communicates with the API
- **ApiService**: Handles API communication
- **StorageService**: Manages storage operations

See the individual files for more details on how they work together.

## Migration Strategy

When migrating existing code to the new architecture, follow these steps:

1. Identify self-contained components in the current codebase
2. Create models, views, and controllers/viewmodels for each component
3. Refactor the component to use the new architecture
4. Update references to the component in other parts of the codebase
5. Repeat for each component until the entire codebase is migrated

## Best Practices

- Keep models, views, and controllers/viewmodels separate
- Use the dependency injection container to manage dependencies
- Use the event bus for cross-component communication
- Write unit tests for models, views, and controllers separately
- Follow the single responsibility principle
- Treat model data as immutable when possible

## Further Reading

For more detailed information about the architecture, see the [architecture.md](../docs/architecture.md) file in the docs directory.
