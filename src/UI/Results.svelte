<script>
    import { createEventDispatcher } from "svelte";
    import externalLink from '../lib/images/external-link.svg'
    
    export let authorName;
    export let authorDescription;
    export let authorLink;
    export let authorCount;

    const dispatch = createEventDispatcher();

    function authorEvent(event) {
        event.preventDefault();
        dispatch('authorEvent');
        console.log('authorEvent', event.type);
    }
</script>

<style lang="scss">
    @import '../scss/variables.scss';

    li {
        margin-bottom: 1rem;
        line-height: 1.2;

        a {
            display: inline-block;
            color: $colour__red;
            text-decoration: none;

            &:hover {
                color: darken($colour__red, 10);
            }
        }
    }

    p {
        margin: 0;
    }

    img {
        width: 0.8rem;
    }
</style>

<li>
    <p>{authorName}</p>
    <p>{authorDescription}</p>
    <a href={authorLink} target="_blank">
        Wikipedia entry 
        <img src={externalLink} alt="" />
    </a>
    <p>
        {authorCount}
        {#if authorCount === 0} 
            quotes
        {:else}
            <a href="/" on:click={(event) => authorEvent(event)}>quote{authorCount === 1 ? `` : `s`}</a>
        {/if}
    </p>
</li>