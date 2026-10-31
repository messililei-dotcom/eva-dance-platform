package cn.com.swod.app;

/** No editable wall clock. A boot mismatch or elapsed-clock reset needs a server refresh. */
final class CacheClock {
    static long trusted(long server,long anchorElapsed,String anchorBoot,long currentElapsed,String currentBoot){
        if(server<=0||anchorElapsed<0||currentElapsed<anchorElapsed||anchorBoot==null||anchorBoot.isEmpty()||!anchorBoot.equals(currentBoot))return Long.MIN_VALUE;
        try{return Math.addExact(server,Math.subtractExact(currentElapsed,anchorElapsed));}catch(ArithmeticException error){return Long.MIN_VALUE;}
    }
}
