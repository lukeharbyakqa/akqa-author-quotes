<script>
    import TextInput from "./UI/TextInput.svelte";
    import Results from "./UI/Results.svelte";

    const apiURL = __app["env"]["API_URL"];
    let results = [];
    let value;
    let success = false;

    let handleSearch = (event) => {
        success = false;
        const url = `${apiURL}/search/authors?query=`
        value = event.target.value;
        if (value.length <= 3) {
            return
        } else if (event.which === 13) {
            fetch(`${url}${event.target.value}`)
                .then(data => {
                    return data.json();
                })
                .then((data) => {
                    success = true;
                    results = data.results;
                });
        }
    };
</script>

<style lang="scss">
    @import './scss/variables.scss';

    .inner {
        padding: 2rem 2.5rem;

        &__wrapper {
            display: flex;
            align-items: center;
        }
    }

    ul {
        transition: opacity 200ms ease-in;
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
        font-weight: bold;
        color: $red;
    }
</style>

<div class="inner">
    <p><strong>Search for quotes by authors</strong></p>
    <div class="inner__wrapper">
        <p>Please enter an author</p>
        <TextInput on:keypress={(event) => handleSearch(event)} />
    </div>
    <ul class={results.length ? `fade-in` : ``}>
        {#if results.length}
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
        <p class="fade-in">Sorry no results for {value}</p>
    {/if}
</div>