<script>    
    export let name = "";
    export let disabled = false;
</script>

<style lang="scss">
    button {
        font-family: monospace;
        border: none;
        cursor: pointer;
        margin: 0 0 0 1rem;

        &[disabled] {
            pointer-events: none;
        }
    }    
</style>

<button type="submit" on:click disabled={disabled}>{name}</button>