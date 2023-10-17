<script>
    import TextInput from "./UI/TextInput.svelte";
    import Button from "./UI/Button.svelte";
    import Results from "./UI/Results.svelte";
    import { site } from './stores/globals';

    const apiURL = site.API_URL;
    const url = `${apiURL}/search/authors?query=`

    let results = [];
    let value = "";
    let success = false;
    let networkError;
    let networkErrorMessage;
    let placeholder = "For example 'Emily Dickinson'. Then hit enter";
    let minLength = 3;

    const fetchAuthorData = (url, value) => {
        fetch(`${url}${value}`)
            .then(data => {
                return data.json();
            })
            .then((data) => {
                success = true;
                results = data.results;
                networkError = false;
            })
            .catch(err => {
                console.warn('Something went wrong.', err);
                networkError = true;
                networkErrorMessage = err;
                handleReset();
            });
    }

    let handleSearchAuthors = (event) => {
        success = false;
        value = event.target.value;
        if (value.length <= minLength) {
            return
        }   
        if (event.which === 13) {
           fetchAuthorData(url, value);
        }
    };

    let handleInputAuthor = (event) => {
        value = event.target.value;
        if (value.length <= minLength) {
            return
        }
    }

    let handleSubmit = () => {
        fetchAuthorData(url, value);
    }

    let handleReset = (event) => {
        event.target.closest('ul').replaceChildren();
        results = [];
        success = false;
        value = "";
    }

    let handleFocus = () => {
        placeholder = "";
    }

    let handleBlur = () => {
        placeholder = "For example 'Emily Dickinson'. Then hit enter";
    }

</script>

<style lang="scss">
    @import './scss/variables.scss';

    :global(
        *, 
        :after, 
        :before
    ) {
        box-sizing: inherit;
    }

    :global(html) {
        overflow-y: scroll;
    }

    :global(body) {
        height: 100%;
    }

    .inner {
        padding: 2rem 2.5rem;

        &__wrapper {
            display: flex;
            align-items: center;
        }
    }

    h2 {
        margin-top: 0;
    }

    ul {
        transition: opacity 200ms ease-in;
        position: relative;
        margin: 2rem 0 0 0;
        padding: 0;
        list-style-type: none;
        opacity: 0;

        &.fade-in {
            transition: opacity 200ms ease-in;
            opacity: 1;
        }
    }

    .results-total {
        color: $colour__red;
    }

    .error {
        color: $colour__green;
    }

    button {
        transition: all 200ms ease-in;
        font-size: 1rem;
        position: absolute;
        right: 0;
        font-family: Arial, Helvetica, sans-serif;
        border: none;
        cursor: pointer;
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        background-color: darken($colour__silver, 18);
        color: $colour__white;

        &:hover {
            transition: all 200ms ease-in;
            background-color: darken($colour__silver, 16);
        }
    }
</style>

<div class="inner">
    <h2>Search for quotes by authors</h2>
    <div class="inner__wrapper">
        <p>Enter an author's name</p>
        <TextInput
            on:input={(event) => handleInputAuthor(event)}
            on:keypress={(event) => handleSearchAuthors(event)}
            on:focus={(event) => handleFocus(event)}
            on:blur={(event) => handleBlur(event)} 
            name={value}
            placeholder={placeholder}
        />
        <Button
            name={'Submit'}
            disabled={value.length <= minLength ? true : false}
            on:click={() => handleSubmit()}
        />
    </div>
    <ul class={results.length ? `fade-in` : ``}>
        {#if results.length}
            <li><button on:click={handleReset} title="Reset">x</button></li>
            {#each results as item (item._id)}
                <Results
                    authorName={item.name}
                    authorDescription={item.description}
                    authorLink={item.link}
                    authorCount={item.quoteCount}
                />
            {/each}
            <li>Total of <span class="results-total">{results.length}</span> results</li>
        {/if}
    </ul>
    {#if value && success && !results.length}
        <p>Sorry no results for {value}</p>
    {/if}
    {#if networkError}
        <p>Sorry there was an error: <span class="error">{networkErrorMessage}</span></p>
    {/if}
</div>