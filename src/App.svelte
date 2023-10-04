<script>
    import TextInput from "./UI/TextInput.svelte";
    import Results from "./UI/Results.svelte";

    const apiURL = __app["env"]["API_URL"];
    let results = [];
    let value;
    let success = false;
    let placeholder = "For example 'Emily Dickinson'. Then hit enter";

    let handleSearch = (event) => {
        success = false;
        const url = `${apiURL}/search/authors?query=`
        value = event.target.value;
        if (value.length < 3) {
            return
        } else if (event.which === 13) {
            fetch(`${url}${value}`)
                .then(data => {
                    return data.json();
                })
                .then((data) => {
                    success = true;
                    results = data.results;
                });
        }
    };

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
    <p><strong>Search for quotes by authors</strong></p>
    <div class="inner__wrapper">
        <p>Enter an author's name</p>
        <TextInput
            on:keypress={(event) => handleSearch(event)}
            on:focus={(event) => handleFocus(event)}
            on:blur={(event) => handleBlur(event)} 
            name={value}
            placeholder={placeholder}
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
</div>