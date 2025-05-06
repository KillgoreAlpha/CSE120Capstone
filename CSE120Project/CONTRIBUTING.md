# Project style guidelines

## Workflow conventions

1. **Fork and/or clone** the repository
2. **Create a branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/my-feature
   ```
   Use naming conventions:<br>
    - feature/ for **feature**
    - bugfix/ for **bugfix**
3. **Submit** a pull request to dev from feature/bugfix branch. Must be reviewed by **at least one** contributor
4. **Conventional Commits standard:**
    ### Format: ### 
    ```bash
    type(scope): description
    body
    footer
    ```
    type: feat, fix, docs, style, refactor, test, etc.<br>
    scope: (Optional): Area of codebase affected by commit.<br>
    description: Concise and imperative description of commit.<br>
    body: (Optional): Provides a more detailed explanation of the commit.<br>
    footer: (Optional): Additional information or metadata related to the commit, often referencing issue or feature tracking IDs.<br>
    ### Example ###
    ```bash
    git commit -m "fix(api): handle null values in response" -m "Handle cases where API response contains null values to prevent errors in downstream processing." -m "Closes #45"
    ```

## Styleguide conventions

1. **PEP8** style guide including but not limited to:
    - docstring
    - error handling
    - type hinting
    - naming convention
    - commenting
    - importing
2. The linter **Pylint** will be used to maintain style guide consistency. 
