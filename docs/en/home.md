# 1. Introduction

No registration required, easy setup!  
InsightBuddy Chat is an AI chat assistant that can be used on websites. By simply setting the API key for your preferred AI provider—whether it's OpenAI, Anthropic, Google, or another—you can start using it immediately.  
Furthermore, it can also connect to your own self-hosted OpenAI-compatible environment.

- As of February 2025, Google's Gemini is partially free, so you can use generative AI for free if you take advantage of it.
- The following article summarizes how to set up an account ( https://j-aic.com/techblog/google-ai-studio-api-free ).

## Quick Access

<div class="quick-actions">
    <div class="action-card" id="chatQuickAction" data-action="open-chat">
        <div class="action-icon">
            <i class="bi bi-chat-dots"></i>
        </div>
        <div class="action-title">Chat</div>
        <div class="action-description">Open full-screen chat</div>
    </div>
    <div class="action-card" data-action="api-settings">
        <div class="action-icon">
            <i class="bi bi-gear"></i>
        </div>
        <div class="action-title">API Settings</div>
        <div class="action-description">Configure providers and API keys</div>
    </div>
    <div class="action-card" data-action="guide-url">
        <div class="action-icon">
            <i class="bi bi-search"></i>
        </div>
        <div class="action-title">Guide URL</div>
        <div class="action-description">Set up site-specific features</div>
    </div>
    <div class="action-card" data-action="system-prompts">
        <div class="action-icon">
            <i class="bi bi-chat-square-text"></i>
        </div>
        <div class="action-title">System Prompts</div>
        <div class="action-description">Configure chat behavior</div>
    </div>
</div>

## 1.1 Key Features

- Supports multiple AI providers
- Enables conversations that take website content into account
- Includes a chat history saving feature
- By using the guide feature, you can perform specific actions on designated sites.

## 1.2 Information Handling

- API keys and chat history are stored only locally on your device.
- For details on how data sent via the chat feature is handled, please review each model provider’s terms of service.
- Our company does not collect usage data or other information solely through this feature.

---

# 2. Initial Setup

## 2.1 Steps to Configure the API Provider

1. **Open the API Settings Screen**  
   - Open the chat widget at the bottom right of the screen  
   - Click the "Home" icon in the bottom menu  
   - Click "API Settings" in the left menu
2. **Select the Provider and Set the API Key**  
   - Locate the card for the desired AI provider  
   - Click the gear icon to enter configuration mode  
   - Enter your API key  
   - Click "Save"
3. **Select the Model**  
   - Click "Select Model" on the provider card  
   - Choose from the list of available models
4. **Enable the Provider**  
   - After configuration, turn on the toggle switch  
   - The status display will update once properly configured

## 2.2 Supported Providers

### OpenAI

- Key format: A string starting with `sk-`
- Main models: GPT-4, GPT-3.5-turbo
- API key acquisition: Available on the OpenAI website

### Anthropic

- Key format: A string starting with `sk-ant-api`
- Main models: Claude-3-Opus, Claude-3-Sonnet
- API key acquisition: Available on the Anthropic website

### Google Gemini

- Key format: A string starting with `AIza`
- Main model: gemini-pro
- API key acquisition: Available on Google Cloud Console

### Deepseek

- Key format: A string starting with `sk-ds-api`
- Main models: Deepseek-LLM, Deepseek-XL
- API key acquisition: Available on the Deepseek website

### OpenAI Compatible

- Key format: Any string (in accordance with the provider's specifications)
- Main models: OpenAI-compatible models provided by the provider
- API key acquisition: Available on each provider's website
- Special notes:
  - Requires custom endpoint URL configuration
  - Requires manual input of the model name
  - Can be used with any service that offers an OpenAI-compatible API

### Local API

- This is InsightBuddy’s proprietary API.
- Available for use upon a separate agreement.
- Offers features such as form reading and a form input interface.

---

# 3. Basic Usage

## 3.1 Starting a Chat

1. Click the blue tab at the right edge of your browser.
2. The chat widget will open.
3. Enter your message in the input field at the bottom.
4. Click the send button or press Enter to send.

## 3.2 Using the Chat Feature

- **Start a New Chat**  
  - Click the "+" icon in the top right.
- **Review Chat History**  
  - Click the clock icon in the bottom menu.  
  - Select a past conversation to view it.
- **Utilize Website Content**  
  - When enabled, the "Retrieve current website content" option allows the assistant to consider the content of the current page when generating a response.

---

# 4. Troubleshooting

## 4.1 Common Errors and Their Solutions

### API Key Error

- **Symptom**: An error stating "API key is invalid."
- **Solution**:
  1. Verify that the API key format is correct.
  2. Check the API key’s expiration date.
  3. Obtain a new API key if necessary.

### Connection Error

- **Symptom**: Unable to send the message.
- **Solution**:
  1. Check your internet connection.
  2. Reload the browser.
  3. Check the status of the API provider.

### Model Selection Error

- **Symptom**: Unable to select a model.
- **Solution**:
  1. Verify the permissions of the API key.
  2. Check the provider’s usage limitations.
  3. Try selecting a different model.

### OpenAI Compatible Connection Error

- **Symptom**: Unable to connect or receive a response.
- **Solution**:
  1. Verify that the endpoint URL is correct.
  2. Ensure that the input model name matches the provider’s specifications.
  3. Confirm that the API key format meets the provider's requirements.
  4. Check the provider's service status.

## 4.2 Resetting Configuration

1. Open the API settings screen.
2. Turn off the settings for each provider.
3. Re-enter the API keys.
4. Re-select the models.

---

# 5. Security and Privacy

## 5.1 Data Handling

- API keys are stored encrypted locally on your device.
- Chat history is stored only locally.
- Website information is used only to the necessary extent.

## 5.2 Recommended Security Measures

- Regularly update API keys.
- Disable providers that are not in use.
- Review your browser’s privacy settings.

## 5.3 Checking for Updates

- Ensure that Chrome extension auto-updates are enabled.
- Regularly review and update your settings.

---

# 6. Technical Specifications

## 6.1 Multi-turn Dialogue System

### Basic Design

- **Maximum number of turns retained:** 4 turns
  - Limited to optimize token usage.
  - One turn = user message + AI response.
  - From the 5th turn onward, the oldest turns are removed.

### Implemented Conversation Management

- **Conversation history managed in Markdown format**
  - **Recent dialogue:** Past conversation history
  - **Current user message:** The current input
  - **Page Context:** Current webpage information (optional)
  - **Markdown configuration:**

    ```markdown
    # Recent dialogue
    ## Turn 1
    ### User
    User's message content
    ### Assistant
    AI's response content
    # Current user message
    Current user's message
    # Page Context (optional)
    Webpage content
    ```

- **A system prompt is appended with each request**
  - Responses are provided in the user's language.
  - There are restrictions on the use of decorations and markdown.
  - Ensures consistency throughout the conversation.
  - **System prompt configuration:**

    ```text
    You are a high-performance AI assistant. Please respond according to the following instructions:

    # Basic Behavior
    - The message posted by the user is stored in ("Current user message").
    - Respond in the same language used by the user in ("Current user message").
    - Keep your responses concise and accurate.
    - Do not use decorations or markdown.

    # Processing Conversation History
    - Understand the context by referring to the provided markdown formatted conversation history ("Recent dialogue").
    - Each turn is provided as "Turn X" and contains the conversation between the user and the assistant.
    - Aim for responses that remain consistent with the previous conversation.

    # Processing Web Information
    - If a "Page Context" section exists, consider the content of that webpage when answering.
    - Use the webpage information as supplementary, referring only to parts directly related to the user's question.
    ```

---

## 6.2 Context Processing System

### Retrieving Webpage Information

- **Implementation for Token Optimization**
  - Retrieve the webpage content anew for each query (not saved in history).
  - Reduce token usage by optimizing the HTML.
  - Remove unnecessary elements (such as `<script>`, `<style>`, `<iframe>`, etc.).
- **Page Context Toggle Feature**
  - Allows users to toggle the feature on or off.
  - Automatically enabled when using the Local API.

### Form Reading Functionality

- Automatically recognizes form elements.
- **Integration with PDF Parsing Functionality**
  - Automatic detection of PDF files.
  - Text extraction process.
  - Integration with the original form context.

---

## 6.3 Provider Management System

### Provider-Specific Implementations

- **OpenAI / Deepseek**
  - Uses Bearer authentication.
  - Supports automatic model retrieval.
- **Anthropic**
  - Uses x-api-key authentication.
  - Requires version specification (e.g., 2023-06-01).
- **Google Gemini**
  - Authenticates using an API key.
  - Supports a unique response format.
- **OpenAI Compatible**
  - Supports custom endpoint configuration.
  - Requires manual model name setting.
  - Allows customizable authentication methods.
- **Local API**
  - Supports custom endpoints.
  - Uses a proprietary authentication system.

### Provider Switching Functionality

- Only one provider can be enabled at a time.
- Performs an integrity check of the configuration:
  - Validates the API key format.
  - Checks for required configuration items.
  - Verifies that a model has been selected.

---

## 6.4 History Management System

### Implemented Saving Functionality

- Retains up to 30 conversation histories.
- **Saved data includes:**
  - Provider information
  - Selected model
  - Timestamp
  - Message history
- **Integration with the Chrome Storage API:**
  - Enables data sharing between extensions.
  - Uses local storage as a fallback.

### History Features

- **Conversation Editing Feature**
  - Allows editing of messages.
  - Regenerates responses after edits.
  - Automatically updates subsequent messages.
- History filtering.
- **Provider Compatibility Check**
  - Verifies that the selected model matches the provider.
  - Displays compatibility warnings if needed.

---

## 6.5 Implementation of the Chat Widget

### UI/UX Features

- **Implemented using iframes**
  - Isolated from the parent page.
  - Communicates via messaging.
- **Responsive Design**
  - Adjusts display based on screen size.
  - Automatically resizes the input area.

### Special Features

- **Displaying Site Information**
  - Renders HTML content.
  - Displays form content.
- **Message Management**
  - Create a new chat.
  - Edit and resend chats (note: reuse of web information is not permitted).
  - Toggle the display of chat history.

---

## 6.6 Security Implementations

### API Management

- **Secure storage of API keys**
  - Uses the Chrome Storage API.
  - Masks keys when they are displayed.

### Data Protection

- **Limiting Page Context**
  - Retrieves only the necessary information.
  - Excludes sensitive data.
- **Local Data Management**
  - Manages session data.

---

## 6.7 Debug Log

- The following debug log is output:

  ```javascript
  console.group('External API Transmission Debug Info');
  console.log('Sent message:', message);
  console.log('API configuration:', {
      provider: apiConfig.provider,
      model: apiConfig.model,
      customSettings: apiConfig.customSettings
  });
  console.log('API response:', result);
  console.groupEnd();
